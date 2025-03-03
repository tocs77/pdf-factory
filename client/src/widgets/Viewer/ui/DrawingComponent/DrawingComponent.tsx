import React, { useEffect, useRef, useState } from 'react';
import { DrawingPath } from '../../model/types/viewerSchema';
import styles from './DrawingComponent.module.scss';

interface DrawingComponentProps {
  scale: number;
  pageNumber: number;
  drawingColor: string;
  drawingLineWidth: number;
  textLayerEnabled: boolean;
  onDrawingComplete?: (drawing: DrawingPath) => void;
}

/**
 * Component for handling the drawing process
 * This component is only visible when text layer is disabled
 */
const DrawingComponent: React.FC<DrawingComponentProps> = ({
  scale,
  pageNumber,
  drawingColor,
  drawingLineWidth,
  textLayerEnabled,
  onDrawingComplete
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  // Store canvas dimensions at the time of drawing
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number } | null>(null);

  // Set up drawing canvas
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled) return;
    
    const canvas = canvasRef.current;
    
    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      
      // Store current canvas dimensions
      setCanvasDimensions({
        width: canvas.width / scale, // Store normalized dimensions (at scale=1)
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
  }, [scale, textLayerEnabled, pageNumber]);

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

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (textLayerEnabled) {
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update canvas dimensions if they've changed
    if (!canvasDimensions || 
        canvasDimensions.width !== canvas.width / scale || 
        canvasDimensions.height !== canvas.height / scale) {
      setCanvasDimensions({
        width: canvas.width / scale,
        height: canvas.height / scale
      });
    }
    
    setIsDrawing(true);
    setCurrentPath([{ x, y }]);
    
    // Start drawing
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = drawingColor;
    // Apply scale to line width for consistent visual appearance
    ctx.lineWidth = drawingLineWidth * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || textLayerEnabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Add point to current path
    setCurrentPath(prev => [...prev, { x, y }]);
    
    // Draw line
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  
  const endDrawing = () => {
    if (!isDrawing || textLayerEnabled) return;
    
    setIsDrawing(false);
    
    // Save drawing if there are at least 2 points
    if (currentPath.length >= 2 && onDrawingComplete && canvasDimensions) {
      // Normalize the points to scale=1 before saving to context
      const normalizedPoints = currentPath.map(point => ({
        x: point.x / scale,
        y: point.y / scale
      }));
      
      onDrawingComplete({
        points: normalizedPoints,
        color: drawingColor,
        lineWidth: drawingLineWidth,
        pageNumber,
        canvasDimensions // Store the canvas dimensions at scale=1
      });
    }
    
    // Reset current path
    setCurrentPath([]);
  };

  // Don't render if text layer is enabled
  if (textLayerEnabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingCanvas}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      style={{ cursor: 'crosshair' }}
    />
  );
};

export default DrawingComponent;
