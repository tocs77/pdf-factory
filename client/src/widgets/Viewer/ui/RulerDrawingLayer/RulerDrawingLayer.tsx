import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
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

export const RulerDrawingLayer: React.FC<RulerDrawingLayerProps> = ({ pageNumber, pdfCanvasRef }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  // Constants for snap detection
  const SNAP_DETECTION_RADIUS = 25; // Radius in pixels to search for snap points
  const SNAP_MIN_DISTANCE = 10; // Minimum distance between detected points
  const MAX_VISIBLE_SNAP_POINTS = 3; // Maximum number of snap points to display
  const SNAP_UPDATE_DELAY = 100; // Delay in ms between snap point updates
  const MOUSE_MOVE_THRESHOLD = 8; // Minimum mouse movement in pixels to trigger snap point update

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [angle, setAngle] = useState<number | null>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isFirstPointPlaced, setIsFirstPointPlaced] = useState(false);
  const [rulerExists, setRulerExists] = useState(false);
  const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
  const [highlightedPointIndex, setHighlightedPointIndex] = useState<number | null>(null);
  const [snapTarget, setSnapTarget] = useState<{ index: number; distance: number } | null>(null);

  // Refs to track the last position where snap points were updated
  const lastUpdatePositionRef = useRef<{ x: number; y: number } | null>(null);

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

  // Draw the ruler line on the canvas
  const drawRuler = () => {
    if (!canvasRef.current || !startPoint || !endPoint) return;

    const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw the line
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.stroke();

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
      ctx.arc(point.x, point.y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
      ctx.strokeStyle = 'rgba(0, 200, 200, 0.7)';
      ctx.fill();
      ctx.lineWidth = 2;
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
      ctx.arc(point.x, point.y, 9, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(0, 220, 0, 0.9)';
      ctx.strokeStyle = 'rgba(0, 180, 0, 1.0)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Calculate distance (in pixels at the current zoom level)
    const pixelDistance = Math.sqrt(Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2));

    // Adjust for zoom level to get the actual distance
    const actualDistance = pixelDistance / scale;
    setDistance(actualDistance);

    // Calculate angle in degrees
    const dx = endPoint.x - startPoint.x;
    const dy = endPoint.y - startPoint.y;
    let angleInDegrees = Math.atan2(dy, dx) * (180 / Math.PI);

    // Normalize angle to 0-360 range
    if (angleInDegrees < 0) {
      angleInDegrees += 360;
    }

    setAngle(angleInDegrees);
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

    if (startPoint && endPoint) {
      drawRuler();
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
    setStartPoint(null);
    setEndPoint(null);
    setDistance(null);
    setAngle(null);
    setIsDrawing(false);
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
    setIsFirstPointPlaced(false);
    setRulerExists(false);
    setPointsOfInterest([]);
    setHighlightedPointIndex(null);
    setSnapTarget(null);
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

    // If ruler already exists and we're not dragging a point, don't allow creating a new one
    if (rulerExists) return;

    // Handle click mode (first point is already placed, waiting for second click)
    if (isFirstPointPlaced) {
      setEndPoint({ x, y });
      setIsFirstPointPlaced(false);
      setRulerExists(true);
      return;
    }

    // Otherwise start a new measurement (either drag mode or first point of click mode)
    setIsDrawing(true);
    setStartPoint({ x, y });
    setEndPoint({ x, y });

    // Find points of interest around the start point
    const points = findPointsOfInterest(x, y);
    setPointsOfInterest(points);
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
      if (isDraggingStart && endPoint) {
        const currentStart = startPoint || { x: 0, y: 0 };
        const moveDist = Math.sqrt(Math.pow(x - currentStart.x, 2) + Math.pow(y - currentStart.y, 2));
        return moveDist >= 2; // Smaller threshold for dragging existing points
      } else if (isDraggingEnd && startPoint) {
        const currentEnd = endPoint || { x: 0, y: 0 };
        const moveDist = Math.sqrt(Math.pow(x - currentEnd.x, 2) + Math.pow(y - currentEnd.y, 2));
        return moveDist >= 2; // Smaller threshold for dragging existing points
      }

      return true;
    })();

    // Skip updates for small movements
    if (!hasSignificantMovement) return;

    if (isDraggingStart && endPoint) {
      setStartPoint({ x, y });
      // Let the useEffect handle finding points
    } else if (isDraggingEnd && startPoint) {
      setEndPoint({ x, y });
      // Let the useEffect handle finding points
    } else if (isDrawing && startPoint) {
      setEndPoint({ x, y });
      // Let the useEffect handle finding points
    }
  };

  // Handle mouse up event
  const handleMouseUp = () => {
    // If we were in drawing mode and have both points, complete the ruler
    if (isDrawing && startPoint && endPoint) {
      // Only set ruler as existing if the points are different
      const distance = Math.sqrt(Math.pow(endPoint.x - startPoint.x, 2) + Math.pow(endPoint.y - startPoint.y, 2));

      if (distance > 5) {
        setRulerExists(true);
      } else {
        // If points are almost the same, we're in click mode, wait for second click
        setIsFirstPointPlaced(true);
      }
    }

    // Apply snapping to the closest point (either snap target or highlighted point)
    if (snapTarget !== null && pointsOfInterest[snapTarget.index]) {
      const snapPoint = pointsOfInterest[snapTarget.index];

      if (isDraggingStart) {
        setStartPoint({ x: snapPoint.x, y: snapPoint.y });
      } else if (isDraggingEnd || isDrawing) {
        setEndPoint({ x: snapPoint.x, y: snapPoint.y });
      }
    }
    // Fallback to highlighted point if no snap target
    else if (highlightedPointIndex !== null && pointsOfInterest[highlightedPointIndex]) {
      const point = pointsOfInterest[highlightedPointIndex];

      if (isDraggingStart) {
        setStartPoint({ x: point.x, y: point.y });
      } else if (isDraggingEnd || isDrawing) {
        setEndPoint({ x: point.x, y: point.y });
      }
    }

    // Only clear state after applying the snap
    setHighlightedPointIndex(null);
    setSnapTarget(null);
    setIsDrawing(false);
    setIsDraggingStart(false);
    setIsDraggingEnd(false);

    // Keep points visible briefly before clearing
    setTimeout(() => {
      setPointsOfInterest([]);
    }, 300); // Increased from 200 to 300ms for better visual feedback
  };

  // Handle mouse leave - only call handleMouseUp if we're not dragging markers
  const handleMouseLeave = () => {
    // Only trigger mouseUp if we're doing initial drawing, not when dragging markers
    if (isDrawing && !isDraggingStart && !isDraggingEnd) {
      handleMouseUp();
    }
  };

  // Handle double click to reset ruler
  const handleDoubleClick = () => {
    resetRuler();
  };

  // Start drag handlers for the markers
  const handleStartMarkerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingStart(true);

    // Delay point detection for smoother initial drag
    setTimeout(() => {
      if (startPoint) {
        const points = findPointsOfInterest(startPoint.x, startPoint.y);
        setPointsOfInterest(points);
      }
    }, 100);
  };

  const handleEndMarkerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnd(true);

    // Delay point detection for smoother initial drag
    setTimeout(() => {
      if (endPoint) {
        const points = findPointsOfInterest(endPoint.x, endPoint.y);
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

      if (isDraggingStart) {
        setStartPoint(lastCoords);
        // Points finding will be handled by the effect
      } else if (isDraggingEnd) {
        setEndPoint(lastCoords);
        // Points finding will be handled by the effect
      }
    };

    const handleDocumentMouseUp = () => {
      // Cancel any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Apply snapping if a snap target exists
      if (snapTarget !== null && pointsOfInterest[snapTarget.index]) {
        const point = pointsOfInterest[snapTarget.index];

        if (isDraggingStart) {
          setStartPoint({ x: point.x, y: point.y });
        } else if (isDraggingEnd) {
          setEndPoint({ x: point.x, y: point.y });
        }
      }
      // Fallback to highlighted point
      else if (highlightedPointIndex !== null && pointsOfInterest[highlightedPointIndex]) {
        const point = pointsOfInterest[highlightedPointIndex];

        if (isDraggingStart) {
          setStartPoint({ x: point.x, y: point.y });
        } else if (isDraggingEnd) {
          setEndPoint({ x: point.x, y: point.y });
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
  }, [isDraggingStart, isDraggingEnd, pointsOfInterest, highlightedPointIndex, snapTarget]);

  // Create positions for the markers and label
  const startMarkerStyle = startPoint
    ? {
        left: `${startPoint.x}px`,
        top: `${startPoint.y}px`,
      }
    : undefined;

  const endMarkerStyle = endPoint
    ? {
        left: `${endPoint.x}px`,
        top: `${endPoint.y}px`,
      }
    : undefined;

  const distanceLabelStyle =
    startPoint && endPoint
      ? (() => {
          // Calculate angle in radians
          const dx = endPoint.x - startPoint.x;
          const dy = endPoint.y - startPoint.y;
          let textAngle = Math.atan2(dy, dx) * (180 / Math.PI);

          // Adjust angle for readability (ensure text is not upside down)
          if (textAngle > 90 || textAngle < -90) {
            textAngle += 180;
          }

          // Position in the center of the line
          const centerX = (startPoint.x + endPoint.x) / 2;
          const centerY = (startPoint.y + endPoint.y) / 2;

          // Calculate offset to position text above the line
          const offsetX = Math.sin((textAngle * Math.PI) / 180) * 15; // 15px offset
          const offsetY = -Math.cos((textAngle * Math.PI) / 180) * 15; // 15px offset

          return {
            left: `${centerX + offsetX}px`,
            top: `${centerY + offsetY}px`,
            transform: `translate(-50%, -50%) rotate(${textAngle}deg)`,
            padding: '3px 8px',
          };
        })()
      : undefined;

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
      {startPoint && (
        <div className={styles.rulerMarker} style={startMarkerStyle} onMouseDown={handleStartMarkerMouseDown} draggable='false' />
      )}
      {endPoint && (
        <div className={styles.rulerMarker} style={endMarkerStyle} onMouseDown={handleEndMarkerMouseDown} draggable='false' />
      )}
      {distance !== null && angle !== null && startPoint && endPoint && (
        <div className={styles.rulerDistance} style={distanceLabelStyle}>
          {`${Math.round(distance)} px`}
        </div>
      )}
    </>
  );
};
