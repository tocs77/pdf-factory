import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { RotationAngle } from '../../model/types/viewerSchema';
import styles from './DrawingComponent.module.scss';

interface DrawingComponentProps {
  pageNumber: number;
}

/**
 * Component for handling freehand drawing
 * This component is only visible when text layer is disabled
 */
export const DrawingComponent: React.FC<DrawingComponentProps> = ({ pageNumber }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, textLayerEnabled, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  // Store canvas dimensions at the time of drawing

  // Set up drawing canvas
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled) return;

    const canvas = canvasRef.current;

    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (parent) {
      // Use parent dimensions directly without any transforms
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;


    } else {
      console.warn('No parent element found for canvas');
    }

    // Clear canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [scale, textLayerEnabled, pageNumber, rotation]);

  // Set cursor to crosshair
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled) return;

    const canvas = canvasRef.current;

    const handleMouseEnter = () => {
      // Force the cursor to be a crosshair
      canvas.style.cursor = 'crosshair';
    };

    canvas.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      canvas.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [textLayerEnabled]);

  // Get raw coordinates relative to canvas
  const getRawCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Get mouse position relative to canvas
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return { x, y };
  };

  // Transform coordinates from current rotation and scale to normalized (scale 1, rotation 0)
  const normalizeCoordinatesToZeroRotation = (
    point: { x: number; y: number },
    canvasWidth: number,
    canvasHeight: number,
  ): { x: number; y: number } => {
    // First normalize to [0,1] range
    const normalizedX = point.x / canvasWidth;
    const normalizedY = point.y / canvasHeight;

    // Calculate center point
    const centerX = 0.5;
    const centerY = 0.5;

    // Translate to origin (center of canvas)
    const translatedX = normalizedX - centerX;
    const translatedY = normalizedY - centerY;

    // Apply inverse rotation
    let rotatedX, rotatedY;

    if (rotation === 90) {
      // Inverse of 90 degrees is -90 degrees (or 270 degrees)
      rotatedX = translatedY;
      rotatedY = -translatedX;
    } else if (rotation === 180) {
      // Inverse of 180 degrees is -180 degrees (or 180 degrees)
      rotatedX = -translatedX;
      rotatedY = -translatedY;
    } else if (rotation === 270) {
      // Inverse of 270 degrees is -270 degrees (or 90 degrees)
      rotatedX = -translatedY;
      rotatedY = translatedX;
    } else {
      // No rotation (0 degrees)
      rotatedX = translatedX;
      rotatedY = translatedY;
    }

    // Translate back from origin
    const finalX = rotatedX + centerX;
    const finalY = rotatedY + centerY;

    // Ensure coordinates are within [0,1] range
    return {
      x: Math.max(0, Math.min(1, finalX)),
      y: Math.max(0, Math.min(1, finalY)),
    };
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (textLayerEnabled) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);


    setIsDrawing(true);
    setCurrentPath([{ x, y }]);

    // Start drawing
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up drawing style
    ctx.beginPath();
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Start from the first point
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || textLayerEnabled) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    // Add point to current path
    setCurrentPath((prevPath) => [...prevPath, { x, y }]);

    // Draw line
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set up drawing style
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw line to the new point
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing || textLayerEnabled || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    // Normalize the path to scale 1 and 0 degrees rotation
    const normalizedPath = currentPath.map((point) => normalizeCoordinatesToZeroRotation(point, canvas.width, canvas.height));

    // Create a new drawing object with normalized coordinates
    const newDrawing = {
      points: normalizedPath,
      color: drawingColor,
      lineWidth: drawingLineWidth / scale, // Store line width at scale 1
      pageNumber,
      rotation: rotation as RotationAngle, // Store the rotation at which the drawing was created
    };

    // Add the drawing to the context
    dispatch({ type: 'addDrawing', payload: newDrawing });

    // Reset state
    setIsDrawing(false);
    setCurrentPath([]);

    // Clear the canvas since the drawing will be rendered by the CompleteDrawings component
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingCanvas}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      data-testid='freehand-drawing-canvas'
    />
  );
};
