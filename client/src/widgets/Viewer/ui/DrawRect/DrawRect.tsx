import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { RotationAngle } from '../../model/types/viewerSchema';
import styles from './DrawRect.module.scss';

interface DrawRectProps {
  pageNumber: number;
}

/**
 * Component for handling rectangle drawing
 * This component is only visible when text layer is disabled
 */
const DrawRect: React.FC<DrawRectProps> = ({ pageNumber }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, textLayerEnabled, pageRotations } = state;
  
  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  // Store canvas dimensions at the time of drawing
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number } | null>(null);

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
      
      // Store current canvas dimensions at scale=1
      setCanvasDimensions({
        width: canvas.width / scale,
        height: canvas.height / scale
      });
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
  const getRawCoordinates = (clientX: number, clientY: number): { x: number, y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse position relative to canvas
    let x = clientX - rect.left;
    let y = clientY - rect.top;
    
    // Normalize coordinates to [0,1] range
    const normalizedX = x / rect.width;
    const normalizedY = y / rect.height;
    
    // Apply rotation to coordinates
    if (rotation === 90) {
      x = normalizedY * canvas.width;
      y = (1 - normalizedX) * canvas.height;
    } else if (rotation === 180) {
      x = (1 - normalizedX) * canvas.width;
      y = (1 - normalizedY) * canvas.height;
    } else if (rotation === 270) {
      x = (1 - normalizedY) * canvas.width;
      y = normalizedX * canvas.height;
    } else {
      // No rotation (0 degrees)
      x = normalizedX * canvas.width;
      y = normalizedY * canvas.height;
    }
    
    return { x, y };
  };

  // Transform coordinates from current rotation to 0 degrees
  const normalizeCoordinatesToZeroRotation = (
    point: { x: number, y: number },
    canvasWidth: number,
    canvasHeight: number
  ): { x: number, y: number } => {
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
      y: Math.max(0, Math.min(1, finalY))
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
    
    // Update canvas dimensions
    setCanvasDimensions({
      width: canvas.width / scale,
      height: canvas.height / scale
    });
    
    setIsDrawing(true);
    setStartPoint({ x, y });
    setEndPoint({ x, y });
  };
  
  const drawRectangle = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || textLayerEnabled || !startPoint) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);
    
    // Update end point
    setEndPoint({ x, y });
    
    // Draw rectangle
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Set up drawing style
    ctx.beginPath();
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    
    // Draw the rectangle
    const width = x - startPoint.x;
    const height = y - startPoint.y;
    ctx.strokeRect(startPoint.x, startPoint.y, width, height);
  };
  
  const endDrawing = () => {
    if (!isDrawing || textLayerEnabled || !startPoint || !endPoint) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      return;
    }
    
    // Only save if the rectangle has some size
    if (Math.abs(endPoint.x - startPoint.x) < 5 || Math.abs(endPoint.y - startPoint.y) < 5) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      
      // Clear the canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      return;
    }
    
    // Normalize the points to 0 degrees rotation
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      startPoint,
      canvas.width,
      canvas.height
    );
    
    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      endPoint,
      canvas.width,
      canvas.height
    );
    
    // Create a new rectangle object with normalized coordinates
    const newRect = {
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      color: drawingColor,
      lineWidth: drawingLineWidth,
      pageNumber,
      canvasDimensions: canvasDimensions || { width: 0, height: 0 },
      // Store the current rotation value
      rotation: rotation as RotationAngle
    };
    
    // Add the rectangle to the context
    dispatch({ type: 'addRectangle', payload: newRect });
    
    // Reset state
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);
    
    // Clear the canvas since the rectangle will be rendered by the CompleteDrawings component
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
      onMouseMove={drawRectangle}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      data-testid="rect-drawing-canvas"
    />
  );
};

export default DrawRect; 