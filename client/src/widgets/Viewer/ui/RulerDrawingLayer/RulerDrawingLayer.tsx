import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import styles from './RulerDrawingLayer.module.scss';

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

    // Draw points of interest
    if (!isDraggingStart && !isDraggingEnd && !isDrawing) {
      // Only draw points of interest when not actively dragging (for better performance)
      pointsOfInterest.forEach((point, index) => {
        ctx.beginPath();
        ctx.arc(point.x, point.y, index === highlightedPointIndex ? 8 : 5, 0, 2 * Math.PI);
        ctx.fillStyle = index === highlightedPointIndex ? 'rgba(255, 255, 0, 0.6)' : 'rgba(0, 255, 255, 0.4)';
        ctx.fill();
        ctx.strokeStyle = index === highlightedPointIndex ? 'rgba(255, 200, 0, 0.8)' : 'rgba(0, 200, 200, 0.6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    } else if (highlightedPointIndex !== null && pointsOfInterest[highlightedPointIndex]) {
      // During dragging, only show the highlighted point
      const point = pointsOfInterest[highlightedPointIndex];
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI);
      ctx.fillStyle = 'rgba(255, 255, 0, 0.6)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

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

  // Find points of interest in the PDF near a given coordinate
  const findPointsOfInterest = (x: number, y: number, radius: number = 25) => {
    if (!pdfCanvasRef?.current) return [];

    const ctx = pdfCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [];

    try {
      // Round coordinates to reduce unnecessary recomputation
      const roundedX = Math.round(x);
      const roundedY = Math.round(y);

      // Get the image data around the cursor
      const imageData = ctx.getImageData(Math.max(0, roundedX - radius), Math.max(0, roundedY - radius), radius * 2, radius * 2);

      // Process the image data to find edges, corners, line endpoints
      const points = analyzeImageData(imageData, roundedX - radius, roundedY - radius);

      // Return found points
      return points;
    } catch (error) {
      console.error('Error analyzing PDF canvas:', error);
      return [];
    }
  };

  // Analyze image data to find potential snap points
  const analyzeImageData = (imageData: ImageData, offsetX: number, offsetY: number): PointOfInterest[] => {
    const { data, width, height } = imageData;
    const points: PointOfInterest[] = [];
    const threshold = 50; // Threshold for edge detection
    const scanStep = 3; // Scan every Nth pixel to improve performance

    // Simple edge detection for demonstration
    for (let y = scanStep; y < height - scanStep; y += scanStep) {
      for (let x = scanStep; x < width - scanStep; x += scanStep) {
        // Check neighboring pixels
        const topIdx = ((y - scanStep) * width + x) * 4;
        const bottomIdx = ((y + scanStep) * width + x) * 4;
        const leftIdx = (y * width + (x - scanStep)) * 4;
        const rightIdx = (y * width + (x + scanStep)) * 4;

        const topGray = (data[topIdx] + data[topIdx + 1] + data[topIdx + 2]) / 3;
        const bottomGray = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
        const leftGray = (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3;
        const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;

        // Check for horizontal or vertical edges
        const horizontalDiff = Math.abs(leftGray - rightGray);
        const verticalDiff = Math.abs(topGray - bottomGray);

        if (horizontalDiff > threshold && verticalDiff > threshold) {
          // This is potentially a corner or intersection
          points.push({
            x: offsetX + x,
            y: offsetY + y,
            type: 'corner',
            confidence: (horizontalDiff + verticalDiff) / 2,
          });
        } else if (horizontalDiff > threshold || verticalDiff > threshold) {
          // This is potentially a line end
          points.push({
            x: offsetX + x,
            y: offsetY + y,
            type: 'line-end',
            confidence: Math.max(horizontalDiff, verticalDiff),
          });
        }
      }
    }

    // Filter out redundant points (points that are very close to each other)
    const filteredPoints: PointOfInterest[] = [];
    const minDistance = 10; // Minimum distance between points

    for (const point of points) {
      if (!filteredPoints.some((p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < minDistance)) {
        filteredPoints.push(point);
      }
    }

    // Sort by confidence (highest first) and limit to 5 most likely points
    return filteredPoints.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
  };

  // Update points of interest when cursor position changes
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const updatePointsWithDelay = (x: number, y: number) => {
      // Clear any existing timeouts
      clearTimeout(timeout);

      // Set a timeout to update the points of interest after dragging has slowed/stopped
      timeout = setTimeout(() => {
        const points = findPointsOfInterest(x, y);
        setPointsOfInterest(points);
      }, 200); // Increase delay to improve performance
    };

    if (isDraggingStart && startPoint) {
      updatePointsWithDelay(startPoint.x, startPoint.y);
    } else if (isDraggingEnd && endPoint) {
      updatePointsWithDelay(endPoint.x, endPoint.y);
    } else if (isDrawing && endPoint) {
      updatePointsWithDelay(endPoint.x, endPoint.y);
    } else {
      setPointsOfInterest([]);
    }

    return () => clearTimeout(timeout);
  }, [isDraggingStart, isDraggingEnd, isDrawing, startPoint, endPoint]);

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
    console.log('isDraggingStart', isDraggingStart);

    if (isDraggingStart && endPoint) {
      setStartPoint({ x, y });

      // Check if cursor is near any point of interest
      checkNearbyPointsOfInterest(x, y);
    } else if (isDraggingEnd && startPoint) {
      console.log('handleMouseMove', e);
      setEndPoint({ x, y });

      // Check if cursor is near any point of interest
      checkNearbyPointsOfInterest(x, y);
    } else if (isDrawing && startPoint) {
      setEndPoint({ x, y });

      // Check if cursor is near any point of interest
      checkNearbyPointsOfInterest(x, y);
    }
  };

  // Check if cursor is near any point of interest and highlight it
  const checkNearbyPointsOfInterest = (x: number, y: number) => {
    const snapDistance = 15; // Distance threshold for highlighting a point

    let closestPointIndex = null;
    let minDistance = snapDistance;

    pointsOfInterest.forEach((point, index) => {
      const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));
      if (distance < minDistance) {
        minDistance = distance;
        closestPointIndex = index;
      }
    });

    setHighlightedPointIndex(closestPointIndex);
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

    // Apply snapping if a point is highlighted
    if (highlightedPointIndex !== null) {
      const point = pointsOfInterest[highlightedPointIndex];

      if (isDraggingStart) {
        setStartPoint({ x: point.x, y: point.y });
      } else if (isDraggingEnd || isDrawing) {
        setEndPoint({ x: point.x, y: point.y });
      }

      setHighlightedPointIndex(null);
    }

    setIsDrawing(false);
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
    setPointsOfInterest([]);
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

      lastCoords = getRawCoordinates(e.clientX, e.clientY);

      // Use requestAnimationFrame to optimize updates
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(updatePosition);
      }
    };

    const updatePosition = () => {
      animationFrameId = 0;

      if (isDraggingStart) {
        setStartPoint(lastCoords);
        // Only check for nearby points if we have points of interest
        if (pointsOfInterest.length > 0) {
          checkNearbyPointsOfInterest(lastCoords.x, lastCoords.y);
        }
      } else if (isDraggingEnd) {
        setEndPoint(lastCoords);
        // Only check for nearby points if we have points of interest
        if (pointsOfInterest.length > 0) {
          checkNearbyPointsOfInterest(lastCoords.x, lastCoords.y);
        }
      }
    };

    const handleDocumentMouseUp = () => {
      // Cancel any pending animation frame
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // Apply snapping if a point is highlighted
      if (highlightedPointIndex !== null) {
        const point = pointsOfInterest[highlightedPointIndex];

        if (isDraggingStart) {
          setStartPoint({ x: point.x, y: point.y });
        } else if (isDraggingEnd) {
          setEndPoint({ x: point.x, y: point.y });
        }

        setHighlightedPointIndex(null);
      }

      setIsDraggingStart(false);
      setIsDraggingEnd(false);
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
  }, [isDraggingStart, isDraggingEnd, pointsOfInterest, highlightedPointIndex]);

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
