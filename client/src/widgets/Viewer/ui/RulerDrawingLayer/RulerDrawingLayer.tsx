import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import { transformCoordinates, normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { ViewerContext } from '../../model/context/viewerContext';
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

interface PointOfInterest {
  x: number;
  y: number;
  type: 'line-end' | 'corner' | 'intersection';
  confidence: number;
}

interface Ruler {
  id: number;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  distance: number;
  angle: number;
}

export const RulerDrawingLayer: React.FC<RulerDrawingLayerProps> = ({ pageNumber, pdfCanvasRef }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations } = state;

  // Get the rotation angle for this page - used in dependency array for redraw
  const rotation = pageRotations[pageNumber] || 0;

  // Track previous rotation for detecting changes
  const prevRotationRef = useRef<number>(rotation);

  // Constants for snap detection
  const SNAP_DETECTION_RADIUS = 25; // Radius in pixels to search for snap points
  const SNAP_MIN_DISTANCE = 10; // Minimum distance between detected points
  const MAX_VISIBLE_SNAP_POINTS = 3; // Maximum number of snap points to display
  const SNAP_UPDATE_DELAY = 100; // Delay in ms between snap point updates
  const MOUSE_MOVE_THRESHOLD = 8; // Minimum mouse movement in pixels to trigger snap point update
  const MARKER_SELECTION_RADIUS = 15; // Radius in pixels to detect clicks on markers

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
  const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
  const [highlightedPointIndex, setHighlightedPointIndex] = useState<number | null>(null);
  const [snapTarget, setSnapTarget] = useState<{ index: number; distance: number } | null>(null);
  const [isMouseButtonDown, setIsMouseButtonDown] = useState(false);
  // Add draggingRulerIndex to track which ruler is being dragged
  const [draggingRulerIndex, setDraggingRulerIndex] = useState<number | null>(null);

  // Refs to track the last position where snap points were updated
  const lastUpdatePositionRef = useRef<{ x: number; y: number } | null>(null);

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
      const markerSize = 10; // Increased from 8 to 10 for better visibility
      const innerSize = 4; // Increased from 3 to 4 for better visibility

      // Draw start point marker with white center and blue ring
      // First draw the outer blue circle
      ctx.beginPath();
      ctx.arc(transformedStartPoint.x, transformedStartPoint.y, markerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(33, 150, 243, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
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
      ctx.fillStyle = 'rgba(33, 150, 243, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
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
      const markerSize = 10; // Increased from 8 to 10 for better visibility
      const innerSize = 4; // Increased from 3 to 4 for better visibility

      // Draw start point marker with white center and blue ring
      // First draw the outer blue circle
      ctx.beginPath();
      ctx.arc(transformedStartPoint.x, transformedStartPoint.y, markerSize, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(33, 150, 243, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
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
      ctx.fillStyle = 'rgba(33, 150, 243, 0.9)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1.5;
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

      // Draw regular points
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.7)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.fill();
      ctx.lineWidth = 1.5;
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
      ctx.arc(point.x, point.y, 10, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 220, 0, 0.9)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fill();
      ctx.lineWidth = 2;
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

  // Analyze image data to find potential snap points
  const analyzeImageData = (imageData: ImageData, offsetX: number, offsetY: number): PointOfInterest[] => {
    const { data, width, height } = imageData;
    const points: PointOfInterest[] = [];
    const threshold = 40; // Threshold for edge detection
    const scanStep = 2; // Scan frequency for better detection

    // Check if the area is blank/empty
    const isBlankArea = (() => {
      // Sample the image data to check for blank areas
      let totalSamples = 0;
      let blankSamples = 0;
      const sampleStep = 4; // Sample every 4th pixel to save processing time

      for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];

          // Consider near-white pixels as blank (allowing for slight variations)
          const isBlankPixel = r > 240 && g > 240 && b > 240;

          totalSamples++;
          if (isBlankPixel) blankSamples++;
        }
      }

      // If more than 95% of the sampled pixels are blank, consider it a blank area
      return blankSamples / totalSamples > 0.95;
    })();

    // If it's a blank area, don't create any snap points
    if (isBlankArea) {
      return [];
    }

    // Advanced detection for corners, intersections and line endpoints
    for (let y = scanStep; y < height - scanStep; y += scanStep) {
      for (let x = scanStep; x < width - scanStep; x += scanStep) {
        // Skip processing for likely blank pixels
        const centerIdx = (y * width + x) * 4;
        const centerRGB = [data[centerIdx], data[centerIdx + 1], data[centerIdx + 2]];
        if (centerRGB[0] > 240 && centerRGB[1] > 240 && centerRGB[2] > 240) continue;

        // Check neighboring pixels in 8 directions
        const topIdx = ((y - scanStep) * width + x) * 4;
        const bottomIdx = ((y + scanStep) * width + x) * 4;
        const leftIdx = (y * width + (x - scanStep)) * 4;
        const rightIdx = (y * width + (x + scanStep)) * 4;
        const topLeftIdx = ((y - scanStep) * width + (x - scanStep)) * 4;
        const topRightIdx = ((y - scanStep) * width + (x + scanStep)) * 4;
        const bottomLeftIdx = ((y + scanStep) * width + (x - scanStep)) * 4;
        const bottomRightIdx = ((y + scanStep) * width + (x + scanStep)) * 4;

        // Get grayscale values for each pixel
        const centerGray = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;
        const topGray = (data[topIdx] + data[topIdx + 1] + data[topIdx + 2]) / 3;
        const bottomGray = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
        const leftGray = (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3;
        const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
        const topLeftGray = (data[topLeftIdx] + data[topLeftIdx + 1] + data[topLeftIdx + 2]) / 3;
        const topRightGray = (data[topRightIdx] + data[topRightIdx + 1] + data[topRightIdx + 2]) / 3;
        const bottomLeftGray = (data[bottomLeftIdx] + data[bottomLeftIdx + 1] + data[bottomLeftIdx + 2]) / 3;
        const bottomRightGray = (data[bottomRightIdx] + data[bottomRightIdx + 1] + data[bottomRightIdx + 2]) / 3;

        // Calculate gradients in different directions
        const horizontalDiff = Math.abs(leftGray - rightGray);
        const verticalDiff = Math.abs(topGray - bottomGray);
        const diag1Diff = Math.abs(topLeftGray - bottomRightGray);
        const diag2Diff = Math.abs(topRightGray - bottomLeftGray);

        // Skip if all gradients are very low - indicates uniform area
        if (
          horizontalDiff < threshold / 2 &&
          verticalDiff < threshold / 2 &&
          diag1Diff < threshold / 2 &&
          diag2Diff < threshold / 2
        ) {
          continue;
        }

        // Get differences between surrounding pixels to detect patterns
        const horizontalGradients = [
          Math.abs(topLeftGray - topGray),
          Math.abs(topGray - topRightGray),
          Math.abs(leftGray - centerGray),
          Math.abs(centerGray - rightGray),
          Math.abs(bottomLeftGray - bottomGray),
          Math.abs(bottomGray - bottomRightGray),
        ];

        const verticalGradients = [
          Math.abs(topLeftGray - leftGray),
          Math.abs(leftGray - bottomLeftGray),
          Math.abs(topGray - centerGray),
          Math.abs(centerGray - bottomGray),
          Math.abs(topRightGray - rightGray),
          Math.abs(rightGray - bottomRightGray),
        ];

        // Calculate edge pattern to distinguish between points on lines vs endpoints/corners
        const isOnHorizontalLine = horizontalGradients.every((gradient) => gradient < threshold / 2) && verticalDiff > threshold;
        const isOnVerticalLine = verticalGradients.every((gradient) => gradient < threshold / 2) && horizontalDiff > threshold;

        // Define surrounding pixel pattern
        const surroundingPixels = [
          topGray,
          rightGray,
          bottomGray,
          leftGray,
          topLeftGray,
          topRightGray,
          bottomLeftGray,
          bottomRightGray,
        ];

        // Count pixels that significantly differ from center (edge pixels)
        const edgeCount = surroundingPixels.filter((gray) => Math.abs(gray - centerGray) > threshold).length;

        // Detect corners - sharp changes in multiple directions simultaneously
        if (
          (horizontalDiff > threshold && verticalDiff > threshold && !isOnHorizontalLine && !isOnVerticalLine) ||
          (diag1Diff > threshold && diag2Diff > threshold)
        ) {
          points.push({
            x: offsetX + x,
            y: offsetY + y,
            type: 'corner',
            confidence: (horizontalDiff + verticalDiff + diag1Diff + diag2Diff) / 4,
          });
        }
        // Detect intersections - multiple edge directions meeting
        else if (
          edgeCount >= 3 &&
          ((horizontalDiff > threshold && verticalDiff > threshold / 2) ||
            (verticalDiff > threshold && horizontalDiff > threshold / 2)) &&
          !isOnHorizontalLine &&
          !isOnVerticalLine
        ) {
          points.push({
            x: offsetX + x,
            y: offsetY + y,
            type: 'intersection',
            confidence: ((horizontalDiff + verticalDiff) / 2) * (edgeCount / 8),
          });
        }
        // Detect line endpoints - look for abrupt ending pattern
        else if (
          edgeCount <= 2 &&
          // At least one direction needs significant change
          (horizontalDiff > threshold || verticalDiff > threshold || diag1Diff > threshold || diag2Diff > threshold) &&
          // Discard points that are likely on straight lines
          !isOnHorizontalLine &&
          !isOnVerticalLine
        ) {
          // Additional endpoint verification - check for endpoint pattern
          // True endpoints have high intensity change in limited directions
          const isEndpoint =
            // Check for patterns that indicate endpoints rather than points along a line
            (horizontalDiff > threshold * 1.2 &&
              surroundingPixels.filter((p) => Math.abs(p - centerGray) < threshold / 2).length >= 5) ||
            (verticalDiff > threshold * 1.2 &&
              surroundingPixels.filter((p) => Math.abs(p - centerGray) < threshold / 2).length >= 5) ||
            (diag1Diff > threshold * 1.2 &&
              surroundingPixels.filter((p) => Math.abs(p - centerGray) < threshold / 2).length >= 5) ||
            (diag2Diff > threshold * 1.2 &&
              surroundingPixels.filter((p) => Math.abs(p - centerGray) < threshold / 2).length >= 5);

          if (isEndpoint) {
            points.push({
              x: offsetX + x,
              y: offsetY + y,
              type: 'line-end',
              confidence: Math.max(horizontalDiff, verticalDiff, diag1Diff, diag2Diff),
            });
          }
        }
      }
    }

    // Filter out redundant points (points that are very close to each other)
    const filteredPoints: PointOfInterest[] = [];

    for (const point of points) {
      if (!filteredPoints.some((p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < SNAP_MIN_DISTANCE)) {
        filteredPoints.push(point);
      }
    }

    // Don't add debug points anymore - let blank areas remain blank
    // Return the found points, sorted by confidence
    return filteredPoints.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  };

  // Throttled version of checkNearbyPointsOfInterest
  const throttledCheckNearbyPoints = useCallback(
    throttle((x: number, y: number) => {
      // Always find the closest point regardless of threshold for better usability
      let closestPointIndex = null;
      let minDistance = Infinity; // Use Infinity to always find the closest point

      pointsOfInterest.forEach((point, index) => {
        const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));

        // Find the closest point, period
        if (distance < minDistance) {
          minDistance = distance;
          closestPointIndex = index;
        }
      });

      // Always highlight the closest point if available
      setHighlightedPointIndex(closestPointIndex);

      // Only set snap target if the points array is not empty
      if (closestPointIndex !== null && pointsOfInterest.length > 0) {
        // Only set as snap target if it's within a reasonable distance (50 pixels)
        // This prevents snap points from appearing too far from cursor
        const MAX_SNAP_DISTANCE = 50;
        if (minDistance <= MAX_SNAP_DISTANCE) {
          setSnapTarget({
            index: closestPointIndex,
            distance: minDistance,
          });
        } else {
          setSnapTarget(null);
        }
      } else {
        setSnapTarget(null);
      }

      // Update the last position where snap points were updated
      lastUpdatePositionRef.current = { x, y };
    }, SNAP_UPDATE_DELAY),
    [pointsOfInterest], // Add pointsOfInterest to dependencies to ensure function updates with new points
  );

  // Check if position has moved far enough to trigger an update
  const hasMovedEnoughToUpdate = (x: number, y: number): boolean => {
    if (!lastUpdatePositionRef.current) return true;

    const { x: lastX, y: lastY } = lastUpdatePositionRef.current;
    const distMoved = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));

    return distMoved >= MOUSE_MOVE_THRESHOLD;
  };

  // Memoize findPointsOfInterest to avoid recreating it on each render
  const memoizedFindPointsOfInterest = useCallback(
    (x: number, y: number) => {
      if (!pdfCanvasRef?.current) return [];

      const ctx = pdfCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!ctx) return [];

      try {
        // Round coordinates to reduce unnecessary recomputation
        const roundedX = Math.round(x);
        const roundedY = Math.round(y);

        // Get the image data around the cursor
        const imageData = ctx.getImageData(
          Math.max(0, roundedX - SNAP_DETECTION_RADIUS),
          Math.max(0, roundedY - SNAP_DETECTION_RADIUS),
          SNAP_DETECTION_RADIUS * 2,
          SNAP_DETECTION_RADIUS * 2,
        );

        // Process the image data to find edges, corners, line endpoints
        const points = analyzeImageData(imageData, roundedX - SNAP_DETECTION_RADIUS, roundedY - SNAP_DETECTION_RADIUS);

        // Return found points
        return points;
      } catch (error) {
        console.error('Error analyzing PDF canvas:', error);
        return [];
      }
    },
    [pdfCanvasRef, SNAP_DETECTION_RADIUS],
  );

  // Throttled version of findPointsOfInterest with distance threshold
  const throttledFindPoints = useCallback(
    throttle((x: number, y: number) => {
      // Only update if the mouse has moved enough since the last update
      if (!hasMovedEnoughToUpdate(x, y)) return;

      const points = memoizedFindPointsOfInterest(x, y);
      setPointsOfInterest(points);

      // Check if there are points to snap to
      if (points.length > 0) {
        throttledCheckNearbyPoints(x, y);
      } else {
        // Update the last position even when no points are found
        lastUpdatePositionRef.current = { x, y };
      }
    }, SNAP_UPDATE_DELAY),
    [memoizedFindPointsOfInterest, throttledCheckNearbyPoints],
  );

  // Update points of interest when cursor position changes
  useEffect(() => {
    // Only run this effect when we're actually dragging or drawing
    if (!isDraggingStart && !isDraggingEnd && !isDrawing) {
      return;
    }

    if (isDraggingStart && startPoint) {
      throttledFindPoints(startPoint.x, startPoint.y);
    } else if (isDraggingEnd && endPoint) {
      throttledFindPoints(endPoint.x, endPoint.y);
    } else if (isDrawing && endPoint) {
      throttledFindPoints(endPoint.x, endPoint.y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    // Include only the coordinates and state flags
    isDraggingStart,
    isDraggingEnd,
    isDrawing,
    startPoint?.x,
    startPoint?.y,
    endPoint?.x,
    endPoint?.y,
    // Don't include throttledFindPoints to avoid dependency cycle
  ]);

  // Ensure throttledFindPoints is available with updated dependencies
  useEffect(() => {
    // This ensures throttledFindPoints always uses the latest state
    // without creating a dependency cycle
  }, [throttledFindPoints, pointsOfInterest]);

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

  // Find points of interest in the PDF near a given coordinate
  const findPointsOfInterest = (x: number, y: number) => {
    if (!pdfCanvasRef?.current) return [];

    const ctx = pdfCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    try {
      // Round coordinates to reduce unnecessary recomputation
      const roundedX = Math.round(x);
      const roundedY = Math.round(y);

      // Get the image data around the cursor
      const imageData = ctx.getImageData(
        Math.max(0, roundedX - SNAP_DETECTION_RADIUS),
        Math.max(0, roundedY - SNAP_DETECTION_RADIUS),
        SNAP_DETECTION_RADIUS * 2,
        SNAP_DETECTION_RADIUS * 2,
      );

      // Process the image data to find edges, corners, line endpoints
      const points = analyzeImageData(imageData, roundedX - SNAP_DETECTION_RADIUS, roundedY - SNAP_DETECTION_RADIUS);

      // Return found points
      return points;
    } catch (error) {
      console.error('Error analyzing PDF canvas:', error);
      return [];
    }
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
      const points = findPointsOfInterest(x, y);
      setPointsOfInterest(points);
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
    const points = findPointsOfInterest(x, y);
    setPointsOfInterest(points);

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
      // Let the useEffect handle finding points
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
        const points = findPointsOfInterest(transformedStartPoint.x, transformedStartPoint.y);
        setPointsOfInterest(points);
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
        const points = findPointsOfInterest(transformedEndPoint.x, transformedEndPoint.y);
        setPointsOfInterest(points);
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
        // Points finding will be handled by the effect
      } else if (isDraggingEnd && draggingRulerIndex !== null) {
        setEndPoint(lastCoords);
        updateRuler(draggingRulerIndex, undefined, normalizedCoords);
        // Points finding will be handled by the effect
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
              const markerSize = 6;

              // Create marker with white center and blue ring using box-shadow
              return {
                left: `${transformed.x}px`,
                top: `${transformed.y}px`,
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                transform: `translate(-50%, -50%)`,
                backgroundColor: 'white', // White center
                border: 'none', // No border
                boxShadow: '0 0 0 2.5px rgba(33, 150, 243, 0.9)', // Blue ring
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
              const markerSize = 6;

              // Create marker with white center and blue ring using box-shadow
              return {
                left: `${transformed.x}px`,
                top: `${transformed.y}px`,
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                transform: `translate(-50%, -50%)`,
                backgroundColor: 'white', // White center
                border: 'none', // No border
                boxShadow: '0 0 0 2.5px rgba(33, 150, 243, 0.9)', // Blue ring
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
              };
            })()}>
            {`${Math.round(ruler.distance)} px`}
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
              const markerSize = 6;

              // Create marker with white center and blue ring using box-shadow
              return {
                left: `${transformed.x}px`,
                top: `${transformed.y}px`,
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                transform: `translate(-50%, -50%)`,
                backgroundColor: 'white', // White center
                border: 'none', // No border
                boxShadow: '0 0 0 2.5px rgba(33, 150, 243, 0.9)', // Blue ring
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
              const markerSize = 6;

              // Create marker with white center and blue ring using box-shadow
              return {
                left: `${transformed.x}px`,
                top: `${transformed.y}px`,
                width: `${markerSize}px`,
                height: `${markerSize}px`,
                transform: `translate(-50%, -50%)`,
                backgroundColor: 'white', // White center
                border: 'none', // No border
                boxShadow: '0 0 0 2.5px rgba(33, 150, 243, 0.9)', // Blue ring
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
                };
              })()}>
              {`${Math.round(distance)} px`}
            </div>
          )}
        </>
      )}
    </>
  );
};
