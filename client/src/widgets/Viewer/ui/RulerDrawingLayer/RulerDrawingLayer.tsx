import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';

import { transformCoordinates, normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { ViewerContext, getCalibrationForPage } from '../../model/context/viewerContext';
import { useSnapPoints } from '../../hooks/useSnapPoints';
import { renderRuler, colorToRgba } from '../../utils/renderers/renderRuler';
import { RulerCalibrationMenu } from '../RulerCalibrationMenu/RulerCalibrationMenu';
import { Ruler as RulerType, Drawing } from '../../model/types/Drawings';

import styles from './RulerDrawingLayer.module.scss';

// Add throttle utility function
const throttle = (fn: Function, delay: number) => {
  let lastCall = 0;
  return function (...args: any[]) {
    const now = Date.now();
    if (now - lastCall < delay) return;
    lastCall = now;
    return fn(...args);
  };
};

interface RulerDrawingLayerProps {
  pageNumber: number;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
  enableSnapPoints?: boolean; // Enable/disable snap points detection
  onDrawingCreated: (drawing: Drawing) => void; // Callback when Rulers drawing is completed
}

type Ruler = RulerType & { id: number };

export const RulerDrawingLayer = (props: RulerDrawingLayerProps) => {
  const { pageNumber, pdfCanvasRef, enableSnapPoints = true, onDrawingCreated } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const {
    scale,
    drawingColor,
    drawingLineWidth,
    drawingMode,
    pageRotations,
    calibration: calibrationMap,
    currentPage,
    requestCancelDrawing,
  } = state;

  // Get the calibration for this page
  const calibration = getCalibrationForPage(calibrationMap, pageNumber);

  // Get the rotation angle for this page - used in dependency array for redraw
  const rotation = pageRotations[pageNumber] || 0;

  // Track previous rotation for detecting changes
  const prevRotationRef = useRef<number>(rotation);

  // Constants for snap detection
  const SNAP_DETECTION_RADIUS = 35; // Increased from 25 to 35px radius to search for snap points
  const SNAP_MIN_DISTANCE = 10; // Minimum distance between detected points
  const MAX_VISIBLE_SNAP_POINTS = 5; // Increased from 3 to 5 maximum snap points to display
  const SNAP_UPDATE_DELAY = 100; // Delay in ms between snap point updates
  const MOUSE_MOVE_THRESHOLD = 8; // Minimum mouse movement in pixels to trigger snap point update
  const MARKER_SELECTION_RADIUS = 15; // Radius in pixels to detect clicks on markers

  // State for calibration menu - track which ruler is selected for calibration
  const [selectedRulerForCalibration, setSelectedRulerForCalibration] = useState<number | null>(null);

  // Use the custom snap points hook (conditionally based on enableSnapPoints)
  const {
    pointsOfInterest,
    highlightedPointIndex,
    snapTarget,
    hasMovedEnoughToUpdate,
    setPointsOfInterest,
    setHighlightedPointIndex,
    setSnapTarget,
    lastUpdatePositionRef,
    throttledFindPoints,
  } = useSnapPoints({
    snapDetectionRadius: SNAP_DETECTION_RADIUS,
    snapMinDistance: SNAP_MIN_DISTANCE,
    maxVisibleSnapPoints: MAX_VISIBLE_SNAP_POINTS,
    snapUpdateDelay: SNAP_UPDATE_DELAY,
    mouseMovementThreshold: MOUSE_MOVE_THRESHOLD,
    pdfCanvasRef: enableSnapPoints ? pdfCanvasRef : undefined, // Disable by passing undefined
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rulers, setRulers] = useState<Ruler[]>([]);
  const [nextRulerId, setNextRulerId] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);

  // Use a ref to track the drawing state more reliably
  const isDrawingRef = useRef(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  // Use refs to track the current points more reliably
  const startPointRef = useRef<{ x: number; y: number } | null>(null);
  const endPointRef = useRef<{ x: number; y: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isMouseButtonDown, setIsMouseButtonDown] = useState(false);
  // Add draggingRulerIndex to track which ruler is being dragged
  const [draggingRulerIndex, setDraggingRulerIndex] = useState<number | null>(null);

  // Handle cancel drawing request from DrawingMenu
  useEffect(() => {
    if (requestCancelDrawing && drawingMode === 'ruler') {
      cancelAllRulers();
      dispatch({ type: 'setDrawingMode', payload: 'none' });
      dispatch({ type: 'requestCancelDrawing', payload: false });
    }
  }, [requestCancelDrawing, drawingMode, dispatch]);

  // Function to cancel all rulers
  const cancelAllRulers = () => {
    setRulers([]);
    setNextRulerId(1);
    resetRuler();
  };

  // Function to clear rulers (called from RulerCalibrationMenu)
  const clearRulers = () => {
    setRulers([]);
    setNextRulerId(1);
  };

  // Wrap setIsDrawing to update both state and ref
  const updateIsDrawing = (value: boolean) => {
    isDrawingRef.current = value;
    setIsDrawing(value);
  };

  // Create a function to initialize the canvas with correct dimensions and context
  const initializeCanvas = useCallback(() => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;

    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    } else {
      console.warn('No parent element found for canvas');
      return null;
    }

    // Get context with willReadFrequently set to true for better performance
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      console.error('Could not get canvas context');
      return null;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    return ctx;
  }, []);

  // Ensure canvas dimensions update when page rotation changes
  useEffect(() => {
    // Wait a bit for parent container to adjust to new rotation
    const timer = setTimeout(() => {
      const ctx = initializeCanvas();
      if (ctx) {
        // Force recalculation of DOM markers after rotation
        // Reference rotation to ensure effect runs when it changes
        void rotation;
        updateRulerPositions();
        drawRuler();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [rotation, initializeCanvas]);

  // Handle scale changes specifically
  useEffect(() => {
    // Reinitialize canvas and redraw when scale changes
    const ctx = initializeCanvas();
    if (ctx) {
      // Force redraw of rulers with new scale
      drawRuler();
      // Force a state update to recalculate DOM markers
      updateRulerPositions();
    }
  }, [scale, initializeCanvas]);

  // Update DOM positions of all ruler elements
  const updateRulerPositions = useCallback(() => {
    if (!canvasRef.current) return;

    // Force a redraw of the markers by triggering state update
    // This will cause React to recalculate all the marker positions
    setRulers((prevRulers) => [...prevRulers]);

    // Force immediate redraw
    drawRuler();

    // Schedule a delayed redraw to ensure everything is in place after React rerender
    setTimeout(() => drawRuler(), 50);
  }, [rotation, scale]);

  // Draw the ruler line on the canvas
  const drawRuler = (forceNoPreview = false) => {
    if (!canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    const canvasWidth = canvasRef.current.width;
    const canvasHeight = canvasRef.current.height;

    // Clear canvas completely before redrawing to prevent old lines
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Prepare preview ruler data if applicable
    const previewRuler =
      !forceNoPreview && startPointRef.current && endPointRef.current && isDrawingRef.current
        ? {
            startPoint: startPointRef.current,
            endPoint: endPointRef.current,
          }
        : null;

    // Use the extracted renderRuler function
    renderRuler(ctx, canvasWidth, canvasHeight, scale, rotation, {
      rulers,
      previewRuler,
      previewColor: previewRuler ? drawingColor : undefined,
      drawingLineWidth,
      enableSnapPoints,
      pointsOfInterest,
      highlightedPointIndex,
      snapTarget,
      maxVisibleSnapPoints: MAX_VISIBLE_SNAP_POINTS,
    });

    // Calculate distance (in pixels at the current zoom level) for the current ruler
    if (startPointRef.current && endPointRef.current && isDrawingRef.current) {
      // Get canvas for calculations
      const canvas = canvasRef.current;
      if (!canvas) return;

      // First normalize the coordinates to account for rotation
      const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
        startPointRef.current,
        canvas.width,
        canvas.height,
        scale,
        rotation,
      );

      const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
        endPointRef.current,
        canvas.width,
        canvas.height,
        scale,
        rotation,
      );

      // Calculate distance using normalized points to get correct measurement regardless of rotation
      const actualDistance = calculateDistance(normalizedStartPoint, normalizedEndPoint);
      setDistance(actualDistance);

      // Calculate angle in degrees using normalized points
      const angle = calculateAngle(normalizedStartPoint, normalizedEndPoint);
      setAngle(angle);
    }
  };

  // Set up drawing canvas whenever scale, rotation, or page changes
  useEffect(() => {
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Check if rotation has changed
    const rotationChanged = prevRotationRef.current !== rotation;
    prevRotationRef.current = rotation;

    // Force a clean redraw when scale or rotation changes to ensure old artifacts are removed
    if (rotationChanged) {
      // Force complete redraw on rotation change
      drawRuler(true);
      // Delay by a small amount and redraw again to ensure all artifacts are removed
      setTimeout(() => drawRuler(), 50);
    } else if (startPoint && endPoint) {
      // No need to reset ruler state when we're actively drawing
      // Just redraw with current points
      drawRuler(false);
      // Delay by a small amount and redraw again to ensure all artifacts are removed
      setTimeout(() => drawRuler(false), 50);
    } else if (rulers.length > 0) {
      // Force a complete redraw of all rulers
      drawRuler(true);
      // Delay by a small amount and redraw again to ensure all artifacts are removed
      setTimeout(() => drawRuler(), 50);
    }
  }, [
    scale,
    pageNumber,
    rotation,
    startPoint,
    endPoint,
    drawingColor,
    drawingLineWidth,
    pointsOfInterest,
    highlightedPointIndex,
    rulers,
    draggingRulerIndex,
  ]);

  // Hide the canvas when ruler tool is not enabled
  useEffect(() => {
    if (!canvasRef.current) return;

    if (drawingMode === 'ruler') {
      canvasRef.current.style.display = 'block';
    } else {
      canvasRef.current.style.display = 'none';
      // Reset ruler state when disabling
      resetRuler();
    }
  }, [drawingMode]);

  // Reset ruler state
  const resetRuler = () => {
    updateIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);
    startPointRef.current = null;
    endPointRef.current = null;
    setDistance(null);
    setAngle(null);
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
    setPointsOfInterest([]);
    setHighlightedPointIndex(null);
    setSnapTarget(null);
    setDraggingRulerIndex(null);
  };

  // Get raw coordinates from mouse event
  const getRawCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const rect = canvasRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return { x, y };
  };

  // Handle mouse down event on canvas
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent default browser drag behavior
    e.preventDefault();

    if (drawingMode !== 'ruler') return;

    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    setIsMouseButtonDown(true);

    // Add global mouseup listener to ensure release is captured even outside canvas
    const handleGlobalMouseUp = () => {
      handleMouseUp();
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);

    // Check if clicked on an existing ruler marker
    const nearestMarker = getNearestRulerMarker(x, y);

    if (nearestMarker) {
      // Set active ruler and initiate dragging
      setDraggingRulerIndex(nearestMarker.rulerIndex);
      if (nearestMarker.isStart) {
        setIsDraggingStart(true);
        const ruler = rulers[nearestMarker.rulerIndex];
        // Use scaled coordinates for UI interactions
        const scaledStartPoint = {
          x: ruler.startPoint.x * scale,
          y: ruler.startPoint.y * scale,
        };
        const scaledEndPoint = {
          x: ruler.endPoint.x * scale,
          y: ruler.endPoint.y * scale,
        };
        setStartPoint(scaledStartPoint);
        setEndPoint(scaledEndPoint);
        startPointRef.current = scaledStartPoint;
        endPointRef.current = scaledEndPoint;
      } else {
        setIsDraggingEnd(true);
        const ruler = rulers[nearestMarker.rulerIndex];
        // Use scaled coordinates for UI interactions
        const scaledStartPoint = {
          x: ruler.startPoint.x * scale,
          y: ruler.startPoint.y * scale,
        };
        const scaledEndPoint = {
          x: ruler.endPoint.x * scale,
          y: ruler.endPoint.y * scale,
        };
        setStartPoint(scaledStartPoint);
        setEndPoint(scaledEndPoint);
        startPointRef.current = scaledStartPoint;
        endPointRef.current = scaledEndPoint;
      }
      // Find points of interest around the clicked marker
      if (enableSnapPoints) {
        throttledFindPoints(x, y);
      }
      return;
    }

    // Clear any previous drawing state
    setStartPoint(null);
    setEndPoint(null);
    startPointRef.current = null;
    endPointRef.current = null;

    // Start a new measurement with dragging mode
    updateIsDrawing(true); // This must update both state and ref

    const newStartPoint = { x, y };
    const newEndPoint = { x, y };
    setStartPoint(newStartPoint);
    setEndPoint(newEndPoint);
    startPointRef.current = newStartPoint;
    endPointRef.current = newEndPoint;
    setDraggingRulerIndex(null); // No active ruler when creating new

    // Find points of interest around the start point
    if (enableSnapPoints) {
      throttledFindPoints(x, y);
    }

    // Make sure everything's drawn correctly
    drawRuler();
  };

  // Handle mouse move event on canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Prevent default browser behavior
    e.preventDefault();

    if (drawingMode !== 'ruler') return;

    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    // When dragging or drawing, only update if we've moved significantly
    const hasSignificantMovement = (() => {
      if (!lastUpdatePositionRef.current) return true;

      // For initial drawing, require more movement to get less flicker
      const requiresUpdate = hasMovedEnoughToUpdate(x, y);
      if (!requiresUpdate) return false;

      // Check what point we're updating
      if (isDraggingStart && endPointRef.current) {
        const currentStart = startPointRef.current || { x: 0, y: 0 };
        const moveDist = Math.sqrt(Math.pow(x - currentStart.x, 2) + Math.pow(y - currentStart.y, 2));
        return moveDist >= 2; // Smaller threshold for dragging existing points
      } else if (isDraggingEnd && startPointRef.current) {
        const currentEnd = endPointRef.current || { x: 0, y: 0 };
        const moveDist = Math.sqrt(Math.pow(x - currentEnd.x, 2) + Math.pow(y - currentEnd.y, 2));
        return moveDist >= 2; // Smaller threshold for dragging existing points
      }

      return true;
    })();

    // Skip updates for small movements
    if (!hasSignificantMovement) {
      return;
    }

    // Get canvas for possible normalization
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (isDraggingStart && endPointRef.current && draggingRulerIndex !== null) {
      const newStartPoint = { x, y };
      setStartPoint(newStartPoint);
      startPointRef.current = newStartPoint;

      // Normalize the point for updating the ruler
      const normalizedPoint = normalizeCoordinatesToZeroRotation(newStartPoint, canvas.width, canvas.height, scale, rotation);

      updateRuler(draggingRulerIndex, normalizedPoint);
      drawRuler(); // Redraw immediately to clear old lines
      // Let the useEffect handle finding points
    } else if (isDraggingEnd && startPointRef.current && draggingRulerIndex !== null) {
      const newEndPoint = { x, y };
      setEndPoint(newEndPoint);
      endPointRef.current = newEndPoint;

      // Normalize the point for updating the ruler
      const normalizedPoint = normalizeCoordinatesToZeroRotation(newEndPoint, canvas.width, canvas.height, scale, rotation);

      updateRuler(draggingRulerIndex, undefined, normalizedPoint);
      drawRuler(); // Redraw immediately to clear old lines
      // Let the useEffect handle finding points
    } else if (isDrawingRef.current && startPointRef.current && isMouseButtonDown) {
      // Only update endpoint if mouse button is still down
      const newEndPoint = { x, y };
      setEndPoint(newEndPoint);
      endPointRef.current = newEndPoint;
      drawRuler(); // Redraw immediately to clear old lines
      // Find snap points around the current mouse position
      if (enableSnapPoints) {
        throttledFindPoints(x, y);
      }
    } else if (drawingMode === 'ruler' && enableSnapPoints) {
      // Always show snap points when hovering in ruler mode, even when not actively drawing
      throttledFindPoints(x, y);
    }
  };

  // Handle mouse up event
  const handleMouseUp = () => {
    setIsMouseButtonDown(false);

    // Capture the current state before any resets - use ref values for reliability
    const wasDrawing = isDrawingRef.current;
    const currentStartPoint = startPointRef.current ? { ...startPointRef.current } : null;
    const currentEndPoint = endPointRef.current ? { ...endPointRef.current } : null;

    // If we were in drawing mode and have both points, complete the ruler
    if (wasDrawing && currentStartPoint && currentEndPoint) {
      // Create a new ruler only if there is significant movement
      const distance = Math.sqrt(
        Math.pow(currentEndPoint.x - currentStartPoint.x, 2) + Math.pow(currentEndPoint.y - currentStartPoint.y, 2),
      );

      if (distance > 20) {
        // Increased minimum distance to prevent ruler creation on simple clicks
        // Get canvas dimensions for normalization
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Normalize the screen coordinates to account for rotation and scale
        // First convert screen coordinates to canvas-relative coordinates
        const screenStartPoint = {
          x: currentStartPoint.x,
          y: currentStartPoint.y,
        };

        const screenEndPoint = {
          x: currentEndPoint.x,
          y: currentEndPoint.y,
        };

        // Normalize coordinates to account for current rotation and scale
        const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
          screenStartPoint,
          canvas.width,
          canvas.height,
          scale,
          rotation,
        );

        const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
          screenEndPoint,
          canvas.width,
          canvas.height,
          scale,
          rotation,
        );

        // Create a new ruler with normalized coordinates
        const newRuler: Ruler = {
          id: nextRulerId,
          // Store normalized coordinates
          startPoint: normalizedStartPoint,
          endPoint: normalizedEndPoint,
          distance: calculateDistance(normalizedStartPoint, normalizedEndPoint),
          angle: calculateAngle(normalizedStartPoint, normalizedEndPoint),
          color: drawingColor, // Store the current drawing color
        };

        setRulers((prevRulers) => {
          const updatedRulers = [...prevRulers, newRuler];
          // Set active ruler index based on the new length
          const newIndex = updatedRulers.length - 1;
          setDraggingRulerIndex(newIndex);
          // Select the new ruler for calibration menu
          setSelectedRulerForCalibration(newIndex);
          return updatedRulers;
        });

        setNextRulerId((prevId) => prevId + 1);
      }

      // Reset drawing state after processing with immediate effect
      updateIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      startPointRef.current = null;
      endPointRef.current = null;

      // Force an immediate redraw with no preview to ensure the preview is cleared
      drawRuler(true); // Force redraw immediately with no preview

      // Also schedule a delayed redraw as a fallback in case state updates are delayed
      setTimeout(() => {
        drawRuler(true); // Force redraw with no preview to ensure the preview is cleared
      }, 300);
    } else if ((isDraggingStart || isDraggingEnd) && draggingRulerIndex !== null) {
      // Update the ruler if we were dragging
      // Get canvas dimensions for normalization
      const canvas = canvasRef.current;
      if (!canvas) return;

      if (snapTarget !== null && pointsOfInterest[snapTarget.index]) {
        const snapPoint = pointsOfInterest[snapTarget.index];
        // Normalize snap point coordinates
        const normalizedPoint = normalizeCoordinatesToZeroRotation(snapPoint, canvas.width, canvas.height, scale, rotation);

        if (isDraggingStart) {
          setStartPoint({ x: snapPoint.x, y: snapPoint.y });
          updateRuler(draggingRulerIndex, normalizedPoint);
        } else {
          setEndPoint({ x: snapPoint.x, y: snapPoint.y });
          updateRuler(draggingRulerIndex, undefined, normalizedPoint);
        }
      } else if (highlightedPointIndex !== null && pointsOfInterest[highlightedPointIndex]) {
        const point = pointsOfInterest[highlightedPointIndex];
        // Normalize point coordinates
        const normalizedPoint = normalizeCoordinatesToZeroRotation(point, canvas.width, canvas.height, scale, rotation);

        if (isDraggingStart) {
          setStartPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, normalizedPoint);
        } else {
          setEndPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, undefined, normalizedPoint);
        }
      }
    }

    // Only clear state after applying the snap
    setHighlightedPointIndex(null);
    setSnapTarget(null);
    setIsDraggingStart(false);
    setIsDraggingEnd(false);

    // Keep points visible briefly before clearing
    setTimeout(() => {
      setPointsOfInterest([]);
    }, 300); // Increased from 200 to 300ms for better visual feedback
  };

  // Handle mouse leave - only log, do not trigger mouseUp
  const handleMouseLeave = () => {
    // Log mouse leave but do not trigger mouseUp as global listener handles it
    if (isDrawingRef.current && !isDraggingStart && !isDraggingEnd && isMouseButtonDown) {
      // Do not call handleMouseUp() to prevent premature ruler creation
    }
  };

  // Touch event handlers for mobile support
  const handleTouchStart = useCallback(
    (e: TouchEvent) => {
      if (drawingMode !== 'ruler') {
        return;
      }
      if (e.touches.length !== 1) {
        return; // Only handle single touch
      }

      // Prevent default touch behavior to avoid scrolling
      e.preventDefault();

      const touch = e.touches[0];
      const { x, y } = getRawCoordinates(touch.clientX, touch.clientY);

      setIsMouseButtonDown(true);

      // Check if touched on an existing ruler marker
      const nearestMarker = getNearestRulerMarker(x, y);

      if (nearestMarker) {
        // Set active ruler and initiate dragging
        setDraggingRulerIndex(nearestMarker.rulerIndex);
        if (nearestMarker.isStart) {
          setIsDraggingStart(true);
          const ruler = rulers[nearestMarker.rulerIndex];
          const scaledStartPoint = {
            x: ruler.startPoint.x * scale,
            y: ruler.startPoint.y * scale,
          };
          const scaledEndPoint = {
            x: ruler.endPoint.x * scale,
            y: ruler.endPoint.y * scale,
          };
          setStartPoint(scaledStartPoint);
          setEndPoint(scaledEndPoint);
          startPointRef.current = scaledStartPoint;
          endPointRef.current = scaledEndPoint;
        } else {
          setIsDraggingEnd(true);
          const ruler = rulers[nearestMarker.rulerIndex];
          const scaledStartPoint = {
            x: ruler.startPoint.x * scale,
            y: ruler.startPoint.y * scale,
          };
          const scaledEndPoint = {
            x: ruler.endPoint.x * scale,
            y: ruler.endPoint.y * scale,
          };
          setStartPoint(scaledStartPoint);
          setEndPoint(scaledEndPoint);
          startPointRef.current = scaledStartPoint;
          endPointRef.current = scaledEndPoint;
        }
        if (enableSnapPoints) {
          throttledFindPoints(x, y);
        }
        return;
      }

      // Clear any previous drawing state
      setStartPoint(null);
      setEndPoint(null);
      startPointRef.current = null;
      endPointRef.current = null;

      // Start a new measurement with dragging mode
      updateIsDrawing(true);

      const newStartPoint = { x, y };
      const newEndPoint = { x, y };
      setStartPoint(newStartPoint);
      setEndPoint(newEndPoint);
      startPointRef.current = newStartPoint;
      endPointRef.current = newEndPoint;
      setDraggingRulerIndex(null);

      if (enableSnapPoints) {
        throttledFindPoints(x, y);
      }

      drawRuler();
    },
    [drawingMode, rulers, scale, enableSnapPoints, throttledFindPoints],
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (drawingMode !== 'ruler') {
        return;
      }
      if (e.touches.length !== 1) {
        return;
      }

      e.preventDefault();

      const touch = e.touches[0];
      const { x, y } = getRawCoordinates(touch.clientX, touch.clientY);

      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      if (isDraggingStart && endPointRef.current && draggingRulerIndex !== null) {
        const newStartPoint = { x, y };
        setStartPoint(newStartPoint);
        startPointRef.current = newStartPoint;

        const normalizedPoint = normalizeCoordinatesToZeroRotation(newStartPoint, canvas.width, canvas.height, scale, rotation);
        updateRuler(draggingRulerIndex, normalizedPoint);
        drawRuler();
      } else if (isDraggingEnd && startPointRef.current && draggingRulerIndex !== null) {
        const newEndPoint = { x, y };
        setEndPoint(newEndPoint);
        endPointRef.current = newEndPoint;

        const normalizedPoint = normalizeCoordinatesToZeroRotation(newEndPoint, canvas.width, canvas.height, scale, rotation);
        updateRuler(draggingRulerIndex, undefined, normalizedPoint);
        drawRuler();
      } else if (isDrawingRef.current && startPointRef.current && isMouseButtonDown) {
        const newEndPoint = { x, y };
        setEndPoint(newEndPoint);
        endPointRef.current = newEndPoint;
        drawRuler();
        if (enableSnapPoints) {
          throttledFindPoints(x, y);
        }
      }
    },
    [
      drawingMode,
      isDraggingStart,
      isDraggingEnd,
      draggingRulerIndex,
      scale,
      rotation,
      isMouseButtonDown,
      enableSnapPoints,
      throttledFindPoints,
    ],
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();

      if (drawingMode !== 'ruler') {
        return;
      }

      // Call the same logic as mouse up
      handleMouseUp();
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drawingMode],
  );

  // Set up touch event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Only add touch listeners when in ruler mode
    if (drawingMode !== 'ruler') {
      return;
    }

    // Add actual handlers
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', handleTouchEnd, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      canvas.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [drawingMode, handleTouchStart, handleTouchMove, handleTouchEnd]);

  // Handle double click to reset or delete ruler
  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);
    const nearestMarker = getNearestRulerMarker(x, y);

    if (nearestMarker) {
      // Delete the ruler that was double-clicked
      deleteRuler(nearestMarker.rulerIndex);
    } else if (e.ctrlKey || e.metaKey) {
      // If Ctrl/Cmd key is pressed, reset all rulers
      resetAllRulers();
    } else {
      // Otherwise, just reset the current drawing state
      resetRuler();
    }
  };

  // Start drag handlers for the markers
  const handleStartMarkerMouseDown = (e: React.MouseEvent, rulerIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingStart(true);
    setDraggingRulerIndex(rulerIndex);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get the transformed screen position of the marker
    const transformedStartPoint = transformCoordinates(
      rulers[rulerIndex].startPoint.x,
      rulers[rulerIndex].startPoint.y,
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    const transformedEndPoint = transformCoordinates(
      rulers[rulerIndex].endPoint.x,
      rulers[rulerIndex].endPoint.y,
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    // Use the screen positions for the UI state
    setStartPoint(transformedStartPoint);
    setEndPoint(transformedEndPoint);
    startPointRef.current = transformedStartPoint;
    endPointRef.current = transformedEndPoint;

    // Delay point detection for smoother initial drag
    if (enableSnapPoints) {
      setTimeout(() => {
        if (rulers[rulerIndex] && canvas) {
          throttledFindPoints(transformedStartPoint.x, transformedStartPoint.y);
        }
      }, 100);
    }
  };

  const handleEndMarkerMouseDown = (e: React.MouseEvent, rulerIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnd(true);
    setDraggingRulerIndex(rulerIndex);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get the transformed screen position of the marker
    const transformedStartPoint = transformCoordinates(
      rulers[rulerIndex].startPoint.x,
      rulers[rulerIndex].startPoint.y,
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    const transformedEndPoint = transformCoordinates(
      rulers[rulerIndex].endPoint.x,
      rulers[rulerIndex].endPoint.y,
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    // Use the screen positions for the UI state
    setStartPoint(transformedStartPoint);
    setEndPoint(transformedEndPoint);
    startPointRef.current = transformedStartPoint;
    endPointRef.current = transformedEndPoint;

    // Delay point detection for smoother initial drag
    if (enableSnapPoints) {
      setTimeout(() => {
        if (rulers[rulerIndex] && canvas) {
          throttledFindPoints(transformedEndPoint.x, transformedEndPoint.y);
        }
      }, 100);
    }
  };

  // Touch handlers for markers
  const handleStartMarkerTouchStart = (e: React.TouchEvent, rulerIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length !== 1) {
      return;
    }

    setIsDraggingStart(true);
    setDraggingRulerIndex(rulerIndex);
    setIsMouseButtonDown(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const transformedStartPoint = transformCoordinates(
      rulers[rulerIndex].startPoint.x,
      rulers[rulerIndex].startPoint.y,
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    const transformedEndPoint = transformCoordinates(
      rulers[rulerIndex].endPoint.x,
      rulers[rulerIndex].endPoint.y,
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    setStartPoint(transformedStartPoint);
    setEndPoint(transformedEndPoint);
    startPointRef.current = transformedStartPoint;
    endPointRef.current = transformedEndPoint;

    if (enableSnapPoints) {
      setTimeout(() => {
        if (rulers[rulerIndex] && canvas) {
          throttledFindPoints(transformedStartPoint.x, transformedStartPoint.y);
        }
      }, 100);
    }
  };

  const handleEndMarkerTouchStart = (e: React.TouchEvent, rulerIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.touches.length !== 1) {
      return;
    }

    setIsDraggingEnd(true);
    setDraggingRulerIndex(rulerIndex);
    setIsMouseButtonDown(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const transformedStartPoint = transformCoordinates(
      rulers[rulerIndex].startPoint.x,
      rulers[rulerIndex].startPoint.y,
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    const transformedEndPoint = transformCoordinates(
      rulers[rulerIndex].endPoint.x,
      rulers[rulerIndex].endPoint.y,
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    setStartPoint(transformedStartPoint);
    setEndPoint(transformedEndPoint);
    startPointRef.current = transformedStartPoint;
    endPointRef.current = transformedEndPoint;

    if (enableSnapPoints) {
      setTimeout(() => {
        if (rulers[rulerIndex] && canvas) {
          throttledFindPoints(transformedEndPoint.x, transformedEndPoint.y);
        }
      }, 100);
    }
  };

  // Handle document-level mouse events for marker dragging
  useEffect(() => {
    if (!isDraggingStart && !isDraggingEnd) return;

    // Use requestAnimationFrame for smoother dragging
    let animationFrameId: number;
    let lastCoords = { x: 0, y: 0 };

    // Initialize with current start/end points
    if (isDraggingStart && draggingRulerIndex !== null && startPoint) {
      lastCoords = { ...startPoint };
    } else if (isDraggingEnd && draggingRulerIndex !== null && endPoint) {
      lastCoords = { ...endPoint };
    }

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const newCoords = getRawCoordinates(e.clientX, e.clientY);

      // Skip position updates for small movements to reduce flicker
      const moveDistance = Math.sqrt(Math.pow(newCoords.x - lastCoords.x, 2) + Math.pow(newCoords.y - lastCoords.y, 2));

      if (moveDistance < 1) return; // Skip tiny movements

      lastCoords = newCoords;

      // Use requestAnimationFrame to optimize updates
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updatePosition);
      }
    };

    const updatePosition = () => {
      animationFrameId = 0;

      if (!canvasRef.current) return;

      // Normalize the coordinates to account for scale and rotation
      const normalizedCoords = normalizeCoordinatesToZeroRotation(
        lastCoords,
        canvasRef.current.width,
        canvasRef.current.height,
        scale,
        rotation,
      );

      if (isDraggingStart && draggingRulerIndex !== null) {
        setStartPoint(lastCoords);
        updateRuler(draggingRulerIndex, normalizedCoords);
        // Find snap points around the cursor during dragging
        if (enableSnapPoints) {
          throttledFindPoints(lastCoords.x, lastCoords.y);
        }
      } else if (isDraggingEnd && draggingRulerIndex !== null) {
        setEndPoint(lastCoords);
        updateRuler(draggingRulerIndex, undefined, normalizedCoords);
        // Find snap points around the cursor during dragging
        if (enableSnapPoints) {
          throttledFindPoints(lastCoords.x, lastCoords.y);
        }
      }
    };

    const handleDocumentMouseUp = () => {
      // Cancel any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      if (!canvasRef.current || draggingRulerIndex === null) return;

      // Apply snapping if a snap target exists
      if (snapTarget !== null && pointsOfInterest[snapTarget.index]) {
        const point = pointsOfInterest[snapTarget.index];
        // Normalize snap point coordinates
        const normalizedPoint = normalizeCoordinatesToZeroRotation(
          point,
          canvasRef.current.width,
          canvasRef.current.height,
          scale,
          rotation,
        );

        if (isDraggingStart) {
          setStartPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, normalizedPoint);
        } else {
          setEndPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, undefined, normalizedPoint);
        }
      }
      // Fallback to highlighted point
      else if (highlightedPointIndex !== null && pointsOfInterest[highlightedPointIndex]) {
        const point = pointsOfInterest[highlightedPointIndex];
        // Normalize point coordinates
        const normalizedPoint = normalizeCoordinatesToZeroRotation(
          point,
          canvasRef.current.width,
          canvasRef.current.height,
          scale,
          rotation,
        );

        if (isDraggingStart) {
          setStartPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, normalizedPoint);
        } else {
          setEndPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, undefined, normalizedPoint);
        }
      }

      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setHighlightedPointIndex(null);
      setSnapTarget(null);

      // Don't clear points of interest immediately - keep them visible briefly
      setTimeout(() => {
        setPointsOfInterest([]);
      }, 300);
    };

    // Touch event handlers for document-level dragging
    const handleDocumentTouchMove = (e: TouchEvent) => {
      if (!canvasRef.current || e.touches.length !== 1) {
        return;
      }

      const touch = e.touches[0];
      const newCoords = getRawCoordinates(touch.clientX, touch.clientY);

      const moveDistance = Math.sqrt(Math.pow(newCoords.x - lastCoords.x, 2) + Math.pow(newCoords.y - lastCoords.y, 2));

      if (moveDistance < 1) return;

      lastCoords = newCoords;

      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updatePosition);
      }
    };

    const handleDocumentTouchEnd = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      if (!canvasRef.current || draggingRulerIndex === null) {
        return;
      }

      // Apply snapping if a snap target exists
      if (snapTarget !== null && pointsOfInterest[snapTarget.index]) {
        const point = pointsOfInterest[snapTarget.index];
        const normalizedPoint = normalizeCoordinatesToZeroRotation(
          point,
          canvasRef.current.width,
          canvasRef.current.height,
          scale,
          rotation,
        );

        if (isDraggingStart) {
          setStartPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, normalizedPoint);
        } else {
          setEndPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, undefined, normalizedPoint);
        }
      } else if (highlightedPointIndex !== null && pointsOfInterest[highlightedPointIndex]) {
        const point = pointsOfInterest[highlightedPointIndex];
        const normalizedPoint = normalizeCoordinatesToZeroRotation(
          point,
          canvasRef.current.width,
          canvasRef.current.height,
          scale,
          rotation,
        );

        if (isDraggingStart) {
          setStartPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, normalizedPoint);
        } else {
          setEndPoint({ x: point.x, y: point.y });
          updateRuler(draggingRulerIndex, undefined, normalizedPoint);
        }
      }

      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsMouseButtonDown(false);
      setHighlightedPointIndex(null);
      setSnapTarget(null);

      setTimeout(() => {
        setPointsOfInterest([]);
      }, 300);
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
    document.addEventListener('touchmove', handleDocumentTouchMove, { passive: false });
    document.addEventListener('touchend', handleDocumentTouchEnd);
    document.addEventListener('touchcancel', handleDocumentTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      document.removeEventListener('touchmove', handleDocumentTouchMove);
      document.removeEventListener('touchend', handleDocumentTouchEnd);
      document.removeEventListener('touchcancel', handleDocumentTouchEnd);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDraggingStart, isDraggingEnd, pointsOfInterest, highlightedPointIndex, snapTarget, draggingRulerIndex]);

  // Calculate distance between two points
  const calculateDistance = (point1: { x: number; y: number }, point2: { x: number; y: number }): number => {
    return Math.sqrt(Math.pow(point2.x - point1.x, 2) + Math.pow(point2.y - point1.y, 2));
  };

  // Calculate angle between two points
  const calculateAngle = (point1: { x: number; y: number }, point2: { x: number; y: number }): number => {
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    let angleInDegrees = Math.atan2(dy, dx) * (180 / Math.PI);

    // Normalize angle to 0-360 range
    if (angleInDegrees < 0) {
      angleInDegrees += 360;
    }

    return angleInDegrees;
  };

  // Check if the point is near a ruler marker
  const getNearestRulerMarker = (x: number, y: number): { rulerIndex: number; isStart: boolean } | null => {
    let minDistance = MARKER_SELECTION_RADIUS;
    let nearestMarker: { rulerIndex: number; isStart: boolean } | null = null;

    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;

    rulers.forEach((ruler, index) => {
      // Transform the ruler points to screen coordinates based on current scale and rotation
      const transformedStartPoint = transformCoordinates(
        ruler.startPoint.x,
        ruler.startPoint.y,
        canvas.width,
        canvas.height,
        scale,
        rotation,
      );

      const transformedEndPoint = transformCoordinates(
        ruler.endPoint.x,
        ruler.endPoint.y,
        canvas.width,
        canvas.height,
        scale,
        rotation,
      );

      // Check distance to transformed points
      const startDistance = calculateDistance({ x, y }, transformedStartPoint);
      if (startDistance < minDistance) {
        minDistance = startDistance;
        nearestMarker = { rulerIndex: index, isStart: true };
      }

      // Check end point
      const endDistance = calculateDistance({ x, y }, transformedEndPoint);
      if (endDistance < minDistance) {
        minDistance = endDistance;
        nearestMarker = { rulerIndex: index, isStart: false };
      }
    });

    return nearestMarker;
  };

  // Update an existing ruler
  const updateRuler = (index: number, start?: { x: number; y: number }, end?: { x: number; y: number }) => {
    if (index < 0 || index >= rulers.length) return;

    const updatedRulers = [...rulers];
    const ruler = { ...updatedRulers[index] };

    // Store normalized coordinates (already normalized by caller)
    if (start) {
      ruler.startPoint = {
        x: start.x,
        y: start.y,
      };
    }

    if (end) {
      ruler.endPoint = {
        x: end.x,
        y: end.y,
      };
    }

    // Recalculate distance and angle - use normalized points
    ruler.distance = calculateDistance(ruler.startPoint, ruler.endPoint);
    ruler.angle = calculateAngle(ruler.startPoint, ruler.endPoint);

    updatedRulers[index] = ruler;
    setRulers(updatedRulers);

    // Select the updated ruler for calibration menu
    setSelectedRulerForCalibration(index);
  };

  // Delete a ruler
  const deleteRuler = (index: number) => {
    if (index < 0 || index >= rulers.length) return;

    const updatedRulers = rulers.filter((_, i) => i !== index);
    setRulers(updatedRulers);

    if (draggingRulerIndex === index) {
      setDraggingRulerIndex(null);
    } else if (draggingRulerIndex !== null && draggingRulerIndex > index) {
      setDraggingRulerIndex(draggingRulerIndex - 1);
    }
  };

  // Reset all rulers
  const resetAllRulers = () => {
    setRulers([]);
    setDraggingRulerIndex(null);
    resetRuler();
  };

  // Redraw canvas whenever rulers or activeRulerIndex changes
  useEffect(() => {
    drawRuler();
  }, [rulers, draggingRulerIndex]);

  // Set up window resize listener
  useEffect(() => {
    const handleResize = throttle(() => {
      const ctx = initializeCanvas();
      if (ctx) {
        updateRulerPositions();
        drawRuler();
      }
    }, 250);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Function to handle click on ruler distance label
  const handleRulerLabelClick = (e: React.MouseEvent, rulerIndex: number) => {
    e.stopPropagation(); // Prevent event from reaching canvas
    e.preventDefault();

    // Select the ruler for calibration menu
    if (rulerIndex >= 0 && rulerIndex < rulers.length) {
      setSelectedRulerForCalibration(rulerIndex);
    }
  };

  // Function to format distance using calibration
  const formatDistance = (pixelDistance: number): string => {
    // Determine if default calibration (no calibration) is being used
    const isDefaultCalibration = calibration.pixelsPerUnit === 1 && calibration.unitName === 'px';

    if (isDefaultCalibration) {
      return `${Math.round(pixelDistance)} px`;
    }

    // Convert pixel distance to calibrated units
    const calibratedDistance = pixelDistance / calibration.pixelsPerUnit;
    return `${calibratedDistance.toFixed(1)} ${calibration.unitName}`;
  };

  // Function to handle double click on ruler distance label
  const handleRulerLabelDoubleClick = (e: React.MouseEvent, rulerIndex: number) => {
    e.stopPropagation(); // Prevent event from reaching canvas
    e.preventDefault();

    if (rulerIndex < 0 || rulerIndex >= rulers.length) return;

    // Select the ruler for calibration menu
    setSelectedRulerForCalibration(rulerIndex);
  };

  // Helper function to get marker style
  const getMarkerStyle = (point: { x: number; y: number }, color: string): React.CSSProperties => {
    const canvas = canvasRef.current;
    if (!canvas) return {};

    const transformed = transformCoordinates(point.x, point.y, canvas.width, canvas.height, scale, rotation);

    const markerSize = 8;
    const markerColor = colorToRgba(color, 0.95);

    return {
      left: `${transformed.x}px`,
      top: `${transformed.y}px`,
      width: `${markerSize}px`,
      height: `${markerSize}px`,
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      border: 'none',
      boxShadow: `0 0 0 3px ${markerColor}`,
      borderRadius: '50%',
      cursor: 'pointer',
      zIndex: 10,
    };
  };

  // Helper function to get marker style for drawing (with normalization)
  const getDrawingMarkerStyle = (point: { x: number; y: number }, color: string): React.CSSProperties => {
    const canvas = canvasRef.current;
    if (!canvas) return {};

    const normalizedPoint = normalizeCoordinatesToZeroRotation(point, canvas.width, canvas.height, scale, rotation);
    const transformed = transformCoordinates(normalizedPoint.x, normalizedPoint.y, canvas.width, canvas.height, scale, rotation);

    const markerSize = 8;
    const markerColor = colorToRgba(color, 0.95);

    return {
      left: `${transformed.x}px`,
      top: `${transformed.y}px`,
      width: `${markerSize}px`,
      height: `${markerSize}px`,
      transform: 'translate(-50%, -50%)',
      backgroundColor: 'white',
      border: 'none',
      boxShadow: `0 0 0 3px ${markerColor}`,
      borderRadius: '50%',
      cursor: 'pointer',
      zIndex: 10,
    };
  };

  // Helper function to get distance label style for completed rulers
  const getDistanceLabelStyle = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
  ): React.CSSProperties => {
    const canvas = canvasRef.current;
    if (!canvas) return {};

    // Calculate angle and midpoint from normalized coordinates
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    let textAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Add rotation to account for page rotation (normalized coords are at 0 rotation, but text is displayed in rotated screen space)
    textAngle += rotation;

    // Normalize angle to 0-360 range
    textAngle = ((textAngle % 360) + 360) % 360;

    // Adjust angle for readability (ensure text is not upside down)
    // If angle is between 90 and 270 degrees, flip it by 180 to keep it readable
    if (textAngle > 90 && textAngle <= 270) {
      textAngle += 180;
      // Normalize again after flipping
      textAngle = ((textAngle % 360) + 360) % 360;
    }

    // Position in the center of the line
    const midPointX = (startPoint.x + endPoint.x) / 2;
    const midPointY = (startPoint.y + endPoint.y) / 2;

    // Transform the midpoint back to screen space
    const transformedMidPoint = transformCoordinates(midPointX, midPointY, canvas.width, canvas.height, scale, rotation);

    // Calculate offset to position text above the line (using the rotated angle)
    const offsetX = Math.sin((textAngle * Math.PI) / 180) * 15;
    const offsetY = -Math.cos((textAngle * Math.PI) / 180) * 15;

    return {
      left: `${transformedMidPoint.x + offsetX}px`,
      top: `${transformedMidPoint.y + offsetY}px`,
      transform: `translate(-50%, -50%) rotate(${textAngle}deg)`,
      padding: '6px 14px',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      border: '1px solid rgba(0, 0, 0, 0.2)',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      zIndex: 15,
      cursor: 'default',
    };
  };

  // Helper function to get distance label style for drawing ruler (with normalization)
  const getDrawingDistanceLabelStyle = (
    startPoint: { x: number; y: number },
    endPoint: { x: number; y: number },
  ): React.CSSProperties => {
    const canvas = canvasRef.current;
    if (!canvas) return {};

    // Normalize start and end points
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(startPoint, canvas.width, canvas.height, scale, rotation);
    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(endPoint, canvas.width, canvas.height, scale, rotation);

    // Calculate angle and midpoint using normalized points
    const dx = normalizedEndPoint.x - normalizedStartPoint.x;
    const dy = normalizedEndPoint.y - normalizedStartPoint.y;
    let textAngle = Math.atan2(dy, dx) * (180 / Math.PI);

    // Add rotation to account for page rotation (normalized coords are at 0 rotation, but text is displayed in rotated screen space)
    textAngle += rotation;

    // Normalize angle to 0-360 range
    textAngle = ((textAngle % 360) + 360) % 360;

    // Adjust angle for readability (ensure text is not upside down)
    // If angle is between 90 and 270 degrees, flip it by 180 to keep it readable
    if (textAngle > 90 && textAngle <= 270) {
      textAngle += 180;
      // Normalize again after flipping
      textAngle = ((textAngle % 360) + 360) % 360;
    }

    // Position in the center of the line using normalized coordinates
    const midPointX = (normalizedStartPoint.x + normalizedEndPoint.x) / 2;
    const midPointY = (normalizedStartPoint.y + normalizedEndPoint.y) / 2;

    // Transform the midpoint back to screen space
    const transformedMidPoint = transformCoordinates(midPointX, midPointY, canvas.width, canvas.height, scale, rotation);

    // Calculate offset to position text above the line (using the rotated angle)
    const offsetX = Math.sin((textAngle * Math.PI) / 180) * 15;
    const offsetY = -Math.cos((textAngle * Math.PI) / 180) * 15;

    return {
      left: `${transformedMidPoint.x + offsetX}px`,
      top: `${transformedMidPoint.y + offsetY}px`,
      transform: `translate(-50%, -50%) rotate(${textAngle}deg)`,
      padding: '6px 14px',
      backgroundColor: 'rgba(255, 255, 255, 0.8)',
      border: '1px solid rgba(0, 0, 0, 0.2)',
      borderRadius: '4px',
      fontSize: '12px',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
      zIndex: 3,
      cursor: 'default',
    };
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={styles.rulerCanvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        draggable='false'
      />

      {/* Render markers and labels for all rulers */}
      {rulers.map((ruler, index) => (
        <React.Fragment key={ruler.id}>
          <div
            className={styles.rulerMarker}
            style={getMarkerStyle(ruler.startPoint, ruler.color)}
            onMouseDown={(e) => handleStartMarkerMouseDown(e, index)}
            onTouchStart={(e) => handleStartMarkerTouchStart(e, index)}
            draggable='false'
          />
          <div
            className={styles.rulerMarker}
            style={getMarkerStyle(ruler.endPoint, ruler.color)}
            onMouseDown={(e) => handleEndMarkerMouseDown(e, index)}
            onTouchStart={(e) => handleEndMarkerTouchStart(e, index)}
            draggable='false'
          />
          <div
            className={styles.rulerDistance}
            style={getDistanceLabelStyle(ruler.startPoint, ruler.endPoint)}
            onDoubleClick={(e) => {
              e.stopPropagation(); // Prevent double-click from reaching canvas
              handleRulerLabelDoubleClick(e, index);
            }}
            onClick={(e) => {
              e.stopPropagation(); // Prevent click from reaching canvas
              handleRulerLabelClick(e, index);
            }}>
            {formatDistance(ruler.distance)}
          </div>
        </React.Fragment>
      ))}

      {/* Render markers for ruler currently being drawn */}
      {isDrawing && startPoint && endPoint && (
        <>
          <div className={styles.rulerMarker} style={getDrawingMarkerStyle(startPoint, drawingColor)} draggable='false' />
          <div className={styles.rulerMarker} style={getDrawingMarkerStyle(endPoint, drawingColor)} draggable='false' />
          {distance !== null && angle !== null && (
            <div
              className={styles.rulerDistance}
              style={getDrawingDistanceLabelStyle(startPoint, endPoint)}
              onClick={(e) => {
                e.stopPropagation(); // Prevent click from reaching canvas
              }}
              onDoubleClick={(e) => {
                e.stopPropagation(); // Prevent double-click from reaching canvas
                // Only allow calibration for completed rulers
              }}>
              {formatDistance(distance)}
            </div>
          )}
        </>
      )}

      {/* Calibration Menu - Only show for current page to avoid multiple dialogs */}
      {drawingMode === 'ruler' && pageNumber === currentPage && (
        <RulerCalibrationMenu
          pixelValue={
            selectedRulerForCalibration !== null && rulers[selectedRulerForCalibration]
              ? rulers[selectedRulerForCalibration].distance
              : rulers.length > 0
                ? rulers[rulers.length - 1].distance
                : 0
          }
          rulers={rulers}
          pageNumber={pageNumber}
          onDrawingCreated={onDrawingCreated}
          onClearRulers={clearRulers}
        />
      )}
    </>
  );
};
