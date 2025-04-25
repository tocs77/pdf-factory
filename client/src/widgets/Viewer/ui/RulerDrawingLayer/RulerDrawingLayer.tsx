import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import { transformCoordinates, normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { ViewerContext } from '../../model/context/viewerContext';
import { useSnapPoints } from '../../../../shared/hooks/useSnapPoints';
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
}

interface Ruler {
  id: number;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  distance: number;
  angle: number;
}

// Interface for calibration settings
interface CalibrationSettings {
  isCalibrated: boolean;
  pixelsPerUnit: number;
  unitName: string;
}

export const RulerDrawingLayer = (props: RulerDrawingLayerProps) => {
  const { pageNumber, pdfCanvasRef } = props;
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations } = state;

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

  // Add state for calibration
  const [calibration, setCalibration] = useState<CalibrationSettings>({
    isCalibrated: false,
    pixelsPerUnit: 1, // Default 1:1 ratio (pixels to unit)
    unitName: 'px', // Default unit is pixels
  });

  // Add state for calibration dialog
  const [showCalibrationDialog, setShowCalibrationDialog] = useState(false);
  const [selectedRulerForCalibration, setSelectedRulerForCalibration] = useState<number | null>(null);
  const [calibrationActualSize, setCalibrationActualSize] = useState('');
  const [calibrationUnit, setCalibrationUnit] = useState('');

  // Use the custom snap points hook
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
    pdfCanvasRef,
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

  // Wrap setIsDrawing to update both state and ref
  const updateIsDrawing = (value: boolean) => {
    isDrawingRef.current = value;
    setIsDrawing(value);
  };

  // Create a function to initialize the canvas with correct dimensions and context
  const initializeCanvas = () => {
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
  };

  // Ensure canvas dimensions update when page rotation changes
  useEffect(() => {
    // Wait a bit for parent container to adjust to new rotation
    const timer = setTimeout(() => {
      const ctx = initializeCanvas();
      if (ctx) {
        // Force recalculation of DOM markers after rotation
        updateRulerPositions();
        drawRuler();
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [rotation]);

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
  }, [scale]);

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

    // Draw all existing rulers
    rulers.forEach((ruler) => {
      // All rulers are drawn with the active style
      const isActive = true; // Previously was checking draggingRulerIndex === index

      // Transform points based on current scale and rotation
      const transformedStartPoint = transformCoordinates(
        ruler.startPoint.x,
        ruler.startPoint.y,
        canvasWidth,
        canvasHeight,
        scale,
        rotation,
      );

      const transformedEndPoint = transformCoordinates(
        ruler.endPoint.x,
        ruler.endPoint.y,
        canvasWidth,
        canvasHeight,
        scale,
        rotation,
      );

      ctx.beginPath();
      ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
      ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
      ctx.strokeStyle = isActive ? 'rgba(255, 165, 0, 0.9)' : drawingColor; // Highlight active ruler
      ctx.lineWidth = isActive ? drawingLineWidth + 1 : drawingLineWidth;
      ctx.stroke();

      // Draw markers at endpoints - use fixed size instead of scale-dependent size
      const markerSize = 12; // Increased from 10 to 12 for better visibility
      const innerSize = 5; // Increased from 4 to 5 for better visibility

      // Draw start point marker with white center and blue ring
      // First draw the outer blue circle
      ctx.beginPath();
      ctx.arc(transformedStartPoint.x, transformedStartPoint.y, markerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(33, 150, 243, 0.95)'; // More opaque blue
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white stroke
      ctx.lineWidth = 2; // Increased stroke width
      ctx.stroke();

      // Then draw the inner white circle
      ctx.beginPath();
      ctx.arc(transformedStartPoint.x, transformedStartPoint.y, innerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'white';
      ctx.fill();

      // Draw end point marker with white center and blue ring
      // First draw the outer blue circle
      ctx.beginPath();
      ctx.arc(transformedEndPoint.x, transformedEndPoint.y, markerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(33, 150, 243, 0.95)'; // More opaque blue
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white stroke
      ctx.lineWidth = 2; // Increased stroke width
      ctx.stroke();

      // Then draw the inner white circle
      ctx.beginPath();
      ctx.arc(transformedEndPoint.x, transformedEndPoint.y, innerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'white';
      ctx.fill();
    });

    // Draw the current ruler being created if applicable, but respect forceNoPreview
    // Use isDrawingRef.current for more reliable state tracking
    if (!forceNoPreview && startPointRef.current && endPointRef.current && isDrawingRef.current) {
      ctx.beginPath();
      ctx.setLineDash([5, 3]); // Dashed line for in-progress ruler

      // For the preview during drawing, we need to make the drawing match the
      // final position the ruler will appear in. First, we need to get screen coordinates
      // and then transform them.

      // Create transformation consistent with where the ruler will be when finalized
      // Instead of dividing by scale, we use the coordinates directly since the ruler preview
      // should match where the ruler will appear when released.
      const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
        startPointRef.current,
        canvasWidth,
        canvasHeight,
        scale,
        rotation,
      );

      const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
        endPointRef.current,
        canvasWidth,
        canvasHeight,
        scale,
        rotation,
      );

      // Then transform them back to get the correct preview position
      const transformedStartPoint = transformCoordinates(
        normalizedStartPoint.x,
        normalizedStartPoint.y,
        canvasWidth,
        canvasHeight,
        scale,
        rotation,
      );

      const transformedEndPoint = transformCoordinates(
        normalizedEndPoint.x,
        normalizedEndPoint.y,
        canvasWidth,
        canvasHeight,
        scale,
        rotation,
      );

      ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
      ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
      ctx.strokeStyle = 'rgba(33, 150, 243, 0.9)';
      ctx.lineWidth = drawingLineWidth;
      ctx.stroke();
      ctx.setLineDash([]); // Reset to solid line

      // Draw markers at endpoints - use fixed size instead of scale-dependent size
      const markerSize = 12; // Increased from 10 to 12 for better visibility
      const innerSize = 5; // Increased from 4 to 5 for better visibility

      // Draw start point marker with white center and blue ring
      // First draw the outer blue circle
      ctx.beginPath();
      ctx.arc(transformedStartPoint.x, transformedStartPoint.y, markerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(33, 150, 243, 0.95)'; // More opaque blue
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white stroke
      ctx.lineWidth = 2; // Increased stroke width
      ctx.stroke();

      // Then draw the inner white circle
      ctx.beginPath();
      ctx.arc(transformedStartPoint.x, transformedStartPoint.y, innerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'white';
      ctx.fill();

      // Draw end point marker with white center and blue ring
      // First draw the outer blue circle
      ctx.beginPath();
      ctx.arc(transformedEndPoint.x, transformedEndPoint.y, markerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(33, 150, 243, 0.95)'; // More opaque blue
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white stroke
      ctx.lineWidth = 2; // Increased stroke width
      ctx.stroke();

      // Then draw the inner white circle
      ctx.beginPath();
      ctx.arc(transformedEndPoint.x, transformedEndPoint.y, innerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'white';
      ctx.fill();
    }

    // Limit visible points to MAX_VISIBLE_SNAP_POINTS
    const visiblePoints = pointsOfInterest
      .sort((a, b) => {
        // Prioritize snap targets and highlighted points
        const aIsSnap = snapTarget && snapTarget.index === pointsOfInterest.indexOf(a);
        const bIsSnap = snapTarget && snapTarget.index === pointsOfInterest.indexOf(b);
        const aIsHighlighted = highlightedPointIndex === pointsOfInterest.indexOf(a);
        const bIsHighlighted = highlightedPointIndex === pointsOfInterest.indexOf(b);

        if (aIsSnap && !bIsSnap) return -1;
        if (!aIsSnap && bIsSnap) return 1;
        if (aIsHighlighted && !bIsHighlighted) return -1;
        if (!aIsHighlighted && bIsHighlighted) return 1;

        // Prioritize corners and intersections over line-ends
        if (a.type !== 'line-end' && b.type === 'line-end') return -1;
        if (a.type === 'line-end' && b.type !== 'line-end') return 1;

        // For the same type, prioritize corners over intersections
        if (a.type === 'corner' && b.type === 'intersection') return -1;
        if (a.type === 'intersection' && b.type === 'corner') return 1;

        // Then sort by confidence
        return b.confidence - a.confidence;
      })
      .slice(0, MAX_VISIBLE_SNAP_POINTS);

    // Draw all points first - to ensure the green one is on top
    visiblePoints.forEach((point) => {
      const index = pointsOfInterest.indexOf(point);
      const isHighlighted = index === highlightedPointIndex;
      const isSnap = snapTarget && snapTarget.index === index;

      // Skip the nearest point in this pass
      if (isSnap || isHighlighted) return;

      // Draw regular points - make them more visible with larger size
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI); // Increased from 6 to 8
      ctx.fillStyle = 'rgba(0, 180, 255, 0.8)'; // Brighter blue with higher opacity
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; // More visible white outline
      ctx.fill();
      ctx.lineWidth = 2; // Thicker outline
      ctx.stroke();
    });

    // Now draw the nearest point (highlighted/snap) on top with larger size and green color
    visiblePoints.forEach((point) => {
      const index = pointsOfInterest.indexOf(point);
      const isHighlighted = index === highlightedPointIndex;
      const isSnap = snapTarget && snapTarget.index === index;

      // Only draw the highlighted/snap point in this pass
      if (!isSnap && !isHighlighted) return;

      // Draw highlighted point bigger and greener for better visibility
      ctx.beginPath();
      ctx.arc(point.x, point.y, 12, 0, 2 * Math.PI); // Increased from 10 to 12
      ctx.fillStyle = isSnap ? 'rgba(0, 220, 0, 0.95)' : 'rgba(255, 165, 0, 0.95)'; // Green for snap, orange for highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white outline
      ctx.fill();
      ctx.lineWidth = 3; // Thicker outline for better visibility
      ctx.stroke();
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
      console.log('Page rotation changed, redrawing rulers');
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
      throttledFindPoints(x, y);
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
    throttledFindPoints(x, y);

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
      throttledFindPoints(x, y);
    } else if (drawingMode === 'ruler') {
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
        };

        setRulers((prevRulers) => {
          const updatedRulers = [...prevRulers, newRuler];
          // Set active ruler index based on the new length
          setDraggingRulerIndex(updatedRulers.length - 1);
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
    setTimeout(() => {
      if (rulers[rulerIndex] && canvas) {
        throttledFindPoints(transformedStartPoint.x, transformedStartPoint.y);
      }
    }, 100);
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
    setTimeout(() => {
      if (rulers[rulerIndex] && canvas) {
        throttledFindPoints(transformedEndPoint.x, transformedEndPoint.y);
      }
    }, 100);
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
        throttledFindPoints(lastCoords.x, lastCoords.y);
      } else if (isDraggingEnd && draggingRulerIndex !== null) {
        setEndPoint(lastCoords);
        updateRuler(draggingRulerIndex, undefined, normalizedCoords);
        // Find snap points around the cursor during dragging
        throttledFindPoints(lastCoords.x, lastCoords.y);
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

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
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

  // Function to apply calibration
  const applyCalibration = (actualSize: number, unitName: string, pixelDistance: number) => {
    // Calculate pixels per unit
    const pixelsPerUnit = pixelDistance / actualSize;

    setCalibration({
      isCalibrated: true,
      pixelsPerUnit,
      unitName,
    });

    console.log(`Calibration applied: ${pixelsPerUnit} pixels per ${unitName}`);
  };

  // Function to format distance using calibration
  const formatDistance = (pixelDistance: number): string => {
    if (!calibration.isCalibrated) {
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

    setSelectedRulerForCalibration(rulerIndex);
    setCalibrationActualSize('');
    setCalibrationUnit('');
    setShowCalibrationDialog(true);
  };

  // Function to handle calibration dialog submission
  const handleCalibrationSubmit = () => {
    if (selectedRulerForCalibration === null) return;

    const actualSize = parseFloat(calibrationActualSize);
    if (isNaN(actualSize) || actualSize <= 0) {
      alert('Please enter a valid positive number for the actual size');
      return;
    }

    // Get the pixel distance of the selected ruler
    const pixelDistance = rulers[selectedRulerForCalibration].distance;

    // Apply the calibration - use empty string if no unit provided
    applyCalibration(actualSize, calibrationUnit.trim() || '', pixelDistance);

    // Close the dialog
    setShowCalibrationDialog(false);
    setSelectedRulerForCalibration(null);
  };

  // Function to cancel calibration
  const handleCalibrationCancel = () => {
    setShowCalibrationDialog(false);
    setSelectedRulerForCalibration(null);
  };

  // Function to reset calibration
  const resetCalibration = () => {
    setCalibration({
      isCalibrated: false,
      pixelsPerUnit: 1,
      unitName: 'px',
    });
  };

  // Function to handle click on ruler distance label
  const handleRulerLabelClick = (e: React.MouseEvent, rulerIndex: number) => {
    e.stopPropagation(); // Prevent event from reaching canvas
    e.preventDefault();

    // You can add additional functionality here for single clicks
    console.log(`Ruler ${rulerIndex} label clicked`);
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
            style={(() => {
              const canvas = canvasRef.current;
              if (!canvas) return {};

              const transformed = transformCoordinates(
                ruler.startPoint.x,
                ruler.startPoint.y,
                canvas.width,
                canvas.height,
                scale,
                rotation,
              );

              // Use smaller marker size for DOM elements to match canvas markers
              const markerSize = 8; // Increased from 6 to 8

              // Create marker with white center and blue ring using box-shadow
              return {
                left: `${transformed.x}px`,
                top: `${transformed.y}px`,
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                transform: `translate(-50%, -50%)`,
                backgroundColor: 'white', // White center
                border: 'none', // No border
                boxShadow: '0 0 0 3px rgba(33, 150, 243, 0.95)', // Thicker, more opaque blue ring
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 10,
              };
            })()}
            onMouseDown={(e) => handleStartMarkerMouseDown(e, index)}
            draggable='false'
          />
          <div
            className={styles.rulerMarker}
            style={(() => {
              const canvas = canvasRef.current;
              if (!canvas) return {};

              const transformed = transformCoordinates(
                ruler.endPoint.x,
                ruler.endPoint.y,
                canvas.width,
                canvas.height,
                scale,
                rotation,
              );

              // Use smaller marker size for DOM elements to match canvas markers
              const markerSize = 8; // Increased from 6 to 8

              // Create marker with white center and blue ring using box-shadow
              return {
                left: `${transformed.x}px`,
                top: `${transformed.y}px`,
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                transform: `translate(-50%, -50%)`,
                backgroundColor: 'white', // White center
                border: 'none', // No border
                boxShadow: '0 0 0 3px rgba(33, 150, 243, 0.95)', // Thicker, more opaque blue ring
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 10,
              };
            })()}
            onMouseDown={(e) => handleEndMarkerMouseDown(e, index)}
            draggable='false'
          />
          <div
            className={styles.rulerDistance}
            style={(() => {
              const canvas = canvasRef.current;
              if (!canvas) return {};

              // Normalize start and end points
              const normalizedStartPoint = ruler.startPoint;
              const normalizedEndPoint = ruler.endPoint;

              // Calculate angle and midpoint using normalized points
              const dx = normalizedEndPoint.x - normalizedStartPoint.x;
              const dy = normalizedEndPoint.y - normalizedStartPoint.y;
              let textAngle = Math.atan2(dy, dx) * (180 / Math.PI);

              // Adjust angle for readability (ensure text is not upside down)
              if (textAngle > 90 || textAngle < -90) {
                textAngle += 180;
              }

              // Position in the center of the line using normalized coordinates
              const midPointX = (normalizedStartPoint.x + normalizedEndPoint.x) / 2;
              const midPointY = (normalizedStartPoint.y + normalizedEndPoint.y) / 2;

              // Transform the midpoint back to screen space
              const transformedMidPoint = transformCoordinates(
                midPointX,
                midPointY,
                canvas.width,
                canvas.height,
                scale,
                rotation,
              );

              // Calculate offset to position text above the line
              const offsetX = Math.sin((textAngle * Math.PI) / 180) * 15; // 15px offset
              const offsetY = -Math.cos((textAngle * Math.PI) / 180) * 15; // 15px offset

              // Adjust font size based on scale
              const fontSize = Math.max(12, Math.min(12 * scale, 18));

              return {
                left: `${transformedMidPoint.x + offsetX}px`,
                top: `${transformedMidPoint.y + offsetY}px`,
                transform: `translate(-50%, -50%) rotate(${textAngle}deg)`,
                padding: '3px 8px',
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
                fontSize: `${fontSize}px`,
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                zIndex: 15,
                cursor: 'pointer', // Add cursor pointer to indicate clickable
              };
            })()}
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
          <div
            className={styles.rulerMarker}
            style={(() => {
              const canvas = canvasRef.current;
              if (!canvas) return {};

              // Normalize coordinates before transforming to ensure
              // preview markers appear in the same location as final rulers
              const normalizedPoint = normalizeCoordinatesToZeroRotation(
                { x: startPoint.x, y: startPoint.y },
                canvas.width,
                canvas.height,
                scale,
                rotation,
              );

              const transformed = transformCoordinates(
                normalizedPoint.x,
                normalizedPoint.y,
                canvas.width,
                canvas.height,
                scale,
                rotation,
              );

              // Use smaller marker size for DOM elements to match canvas markers
              const markerSize = 8; // Increased from 6 to 8

              // Create marker with white center and blue ring using box-shadow
              return {
                left: `${transformed.x}px`,
                top: `${transformed.y}px`,
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                transform: `translate(-50%, -50%)`,
                backgroundColor: 'white', // White center
                border: 'none', // No border
                boxShadow: '0 0 0 3px rgba(33, 150, 243, 0.95)', // Thicker, more opaque blue ring
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 10,
              };
            })()}
            draggable='false'
          />
          <div
            className={styles.rulerMarker}
            style={(() => {
              const canvas = canvasRef.current;
              if (!canvas) return {};

              // Normalize coordinates before transforming to ensure
              // preview markers appear in the same location as final rulers
              const normalizedPoint = normalizeCoordinatesToZeroRotation(
                { x: endPoint.x, y: endPoint.y },
                canvas.width,
                canvas.height,
                scale,
                rotation,
              );

              const transformed = transformCoordinates(
                normalizedPoint.x,
                normalizedPoint.y,
                canvas.width,
                canvas.height,
                scale,
                rotation,
              );

              // Use smaller marker size for DOM elements to match canvas markers
              const markerSize = 8; // Increased from 6 to 8

              // Create marker with white center and blue ring using box-shadow
              return {
                left: `${transformed.x}px`,
                top: `${transformed.y}px`,
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                transform: `translate(-50%, -50%)`,
                backgroundColor: 'white', // White center
                border: 'none', // No border
                boxShadow: '0 0 0 3px rgba(33, 150, 243, 0.95)', // Thicker, more opaque blue ring
                borderRadius: '50%',
                cursor: 'pointer',
                zIndex: 10,
              };
            })()}
            draggable='false'
          />
          {distance !== null && angle !== null && (
            <div
              className={styles.rulerDistance}
              style={(() => {
                const canvas = canvasRef.current;
                if (!canvas) return {};

                // Normalize start and end points
                const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
                  startPoint,
                  canvas.width,
                  canvas.height,
                  scale,
                  rotation,
                );

                const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
                  endPoint,
                  canvas.width,
                  canvas.height,
                  scale,
                  rotation,
                );

                // Calculate angle and midpoint using normalized points
                const dx = normalizedEndPoint.x - normalizedStartPoint.x;
                const dy = normalizedEndPoint.y - normalizedStartPoint.y;
                let textAngle = Math.atan2(dy, dx) * (180 / Math.PI);

                // Adjust angle for readability (ensure text is not upside down)
                if (textAngle > 90 || textAngle < -90) {
                  textAngle += 180;
                }

                // Position in the center of the line using normalized coordinates
                const midPointX = (normalizedStartPoint.x + normalizedEndPoint.x) / 2;
                const midPointY = (normalizedStartPoint.y + normalizedEndPoint.y) / 2;

                // Transform the midpoint back to screen space
                const transformedMidPoint = transformCoordinates(
                  midPointX,
                  midPointY,
                  canvas.width,
                  canvas.height,
                  scale,
                  rotation,
                );

                // Calculate offset to position text above the line
                const offsetX = Math.sin((textAngle * Math.PI) / 180) * 15; // 15px offset
                const offsetY = -Math.cos((textAngle * Math.PI) / 180) * 15; // 15px offset

                // Adjust font size based on scale
                const fontSize = Math.max(12, Math.min(12 * scale, 18));

                return {
                  left: `${transformedMidPoint.x + offsetX}px`,
                  top: `${transformedMidPoint.y + offsetY}px`,
                  transform: `translate(-50%, -50%) rotate(${textAngle}deg)`,
                  padding: '3px 8px',
                  backgroundColor: 'rgba(255, 255, 255, 0.8)',
                  border: '1px solid rgba(0, 0, 0, 0.2)',
                  borderRadius: '4px',
                  fontSize: `${fontSize}px`,
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  zIndex: 15,
                  cursor: 'pointer', // Add cursor pointer to indicate clickable
                };
              })()}
              onClick={(e) => {
                e.stopPropagation(); // Prevent click from reaching canvas
                console.log('Drawing ruler label clicked');
              }}
              onDoubleClick={(e) => {
                e.stopPropagation(); // Prevent double-click from reaching canvas
                console.log('Cannot calibrate an incomplete ruler');
                // Only allow calibration for completed rulers
              }}>
              {formatDistance(distance)}
            </div>
          )}
        </>
      )}

      {/* Calibration Dialog */}
      {showCalibrationDialog && (
        <div className={styles.calibrationDialog}>
          <div
            className={styles.calibrationDialogContent}
            style={{
              fontSize: '14px',
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
              padding: '24px',
            }}>
            <h3
              style={{
                fontSize: '20px',
                fontWeight: 600,
                marginTop: 0,
                marginBottom: '20px',
              }}>
              Калибровка линейки
            </h3>

            <p
              style={{
                fontSize: '14px',
                marginBottom: '24px',
                lineHeight: '1.5',
              }}>
              Введите реальный размер этого измерения:
            </p>

            <div className={styles.calibrationInputGroup} style={{ marginBottom: '20px' }}>
              <label
                htmlFor='actualSize'
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  display: 'block',
                }}>
                Реальный размер:
              </label>
              <input
                id='actualSize'
                type='number'
                step='any'
                min='0.001'
                value={calibrationActualSize}
                onChange={(e) => setCalibrationActualSize(e.target.value)}
                placeholder='Введите значение'
                style={{
                  fontSize: '14px',
                  padding: '10px',
                  width: '100%',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              />
            </div>

            <div className={styles.calibrationInputGroup} style={{ marginBottom: '28px' }}>
              <label
                htmlFor='unitName'
                style={{
                  fontSize: '14px',
                  fontWeight: 500,
                  marginBottom: '8px',
                  display: 'block',
                }}>
                Единица измерения (необязательно):
              </label>
              <input
                id='unitName'
                type='text'
                value={calibrationUnit}
                onChange={(e) => setCalibrationUnit(e.target.value)}
                placeholder='например, см, мм, дюйм (или оставьте пустым)'
                style={{
                  fontSize: '14px',
                  padding: '10px',
                  width: '100%',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                }}
              />
            </div>

            <div
              className={styles.calibrationButtons}
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                marginTop: '20px',
              }}>
              <button
                onClick={handleCalibrationSubmit}
                style={{
                  fontSize: '14px',
                  padding: '10px 16px',
                  backgroundColor: '#2196F3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}>
                Применить
              </button>
              <button
                onClick={handleCalibrationCancel}
                style={{
                  fontSize: '14px',
                  padding: '10px 16px',
                  backgroundColor: '#f5f5f5',
                  color: '#333',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                }}>
                Отмена
              </button>
              {calibration.isCalibrated && (
                <button
                  onClick={resetCalibration}
                  style={{
                    fontSize: '14px',
                    padding: '10px 16px',
                    backgroundColor: '#f44336',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}>
                  Сбросить калибровку
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
