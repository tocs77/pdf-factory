import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
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
  const getRawCoordinates = (clientX: number, clientY: number): { x: number, y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse position relative to canvas
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    return { x, y };
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
    const point = getRawCoordinates(e.clientX, e.clientY);
    
    setIsDrawing(true);
    setStartPoint(point);
    setEndPoint(point);
  };
  
  const drawRectangle = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || textLayerEnabled || !startPoint) return;
    
    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);
    setEndPoint(point);
    
    // Draw rectangle
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw rectangle
    ctx.beginPath();
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.rect(
      startPoint.x,
      startPoint.y,
      point.x - startPoint.x,
      point.y - startPoint.y
    );
    ctx.stroke();
  };
  
  const endDrawing = () => {
    if (!isDrawing || textLayerEnabled || !startPoint || !endPoint) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      return;
    }
    
    // Normalize coordinates to scale 1 and 0 degrees rotation
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      startPoint,
      canvas.width,
      canvas.height,
      scale,
      rotation
    );
    
    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      endPoint,
      canvas.width,
      canvas.height,
      scale,
      rotation
    );
    
    // Create a new rectangle object with normalized coordinates
    const newRectangle = {
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      color: drawingColor,
      lineWidth: drawingLineWidth / scale, // Store line width at scale 1
      pageNumber,
    };
    
    // Add the rectangle to the context
    dispatch({ type: 'addRectangle', payload: newRectangle });
    
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