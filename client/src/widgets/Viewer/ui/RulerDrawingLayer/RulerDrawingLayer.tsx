import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import styles from './RulerDrawingLayer.module.scss';

interface RulerDrawingLayerProps {
  pageNumber: number;
}

export const RulerDrawingLayer: React.FC<RulerDrawingLayerProps> = ({ pageNumber }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations, rulerEnabled } = state;

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

    // Get context
    const ctx = canvas.getContext('2d');
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

    const ctx = canvasRef.current.getContext('2d');
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

  // Set up drawing canvas whenever scale, rotation, or page changes
  useEffect(() => {
    const ctx = initializeCanvas();
    if (!ctx) return;

    if (startPoint && endPoint) {
      drawRuler();
    }
  }, [scale, pageNumber, rotation, startPoint, endPoint, drawingColor, drawingLineWidth]);

  // Hide the canvas when ruler tool is not enabled
  useEffect(() => {
    if (!canvasRef.current) return;

    if (drawingMode === 'ruler' && rulerEnabled) {
      canvasRef.current.style.display = 'block';
    } else {
      canvasRef.current.style.display = 'none';
      // Reset ruler state when disabling
      resetRuler();
    }
  }, [drawingMode, rulerEnabled]);

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
    if (drawingMode !== 'ruler' || !rulerEnabled) return;

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
  };

  // Handle mouse move event on canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawingMode !== 'ruler' || !rulerEnabled) return;

    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    if (isDraggingStart && endPoint) {
      setStartPoint({ x, y });
    } else if (isDraggingEnd && startPoint) {
      setEndPoint({ x, y });
    } else if (isDrawing && startPoint) {
      setEndPoint({ x, y });
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

    setIsDrawing(false);
    setIsDraggingStart(false);
    setIsDraggingEnd(false);
  };

  // Handle double click to reset ruler
  const handleDoubleClick = () => {
    resetRuler();
  };

  // Start drag handlers for the markers
  const handleStartMarkerMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingStart(true);
  };

  const handleEndMarkerMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDraggingEnd(true);
  };

  // Handle document-level mouse events for marker dragging
  useEffect(() => {
    if (!isDraggingStart && !isDraggingEnd) return;

    const handleDocumentMouseMove = (e: MouseEvent) => {
      if (!canvasRef.current) return;

      const coords = getRawCoordinates(e.clientX, e.clientY);

      if (isDraggingStart) {
        setStartPoint(coords);
      } else if (isDraggingEnd) {
        setEndPoint(coords);
      }
    };

    const handleDocumentMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
    };

    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    };
  }, [isDraggingStart, isDraggingEnd]);

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
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      />
      {startPoint && <div className={styles.rulerMarker} style={startMarkerStyle} onMouseDown={handleStartMarkerMouseDown} />}
      {endPoint && <div className={styles.rulerMarker} style={endMarkerStyle} onMouseDown={handleEndMarkerMouseDown} />}
      {distance !== null && angle !== null && startPoint && endPoint && (
        <div className={styles.rulerDistance} style={distanceLabelStyle}>
          {`${Math.round(distance)} px`}
        </div>
      )}
    </>
  );
};
