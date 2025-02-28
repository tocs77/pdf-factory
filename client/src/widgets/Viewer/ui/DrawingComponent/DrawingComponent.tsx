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
  existingDrawings?: DrawingPath[];
}

const DrawingComponent: React.FC<DrawingComponentProps> = ({
  scale,
  pageNumber,
  drawingColor,
  drawingLineWidth,
  textLayerEnabled,
  onDrawingComplete,
  existingDrawings = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  // Store canvas dimensions at the time of drawing
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number } | null>(null);

  // Log when component mounts or updates
  useEffect(() => {
    console.log(`DrawingComponent mounted/updated for page ${pageNumber}`);
    console.log(`Text layer enabled: ${textLayerEnabled}`);
    console.log(`Existing drawings: ${existingDrawings.length}`);
    console.log(`Current scale: ${scale}`);
    
    return () => {
      console.log(`DrawingComponent unmounting for page ${pageNumber}`);
    };
  }, [pageNumber, textLayerEnabled, existingDrawings.length, scale]);

  // Set up drawing canvas and render existing drawings
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled) return;
    
    const canvas = canvasRef.current;
    
    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      console.log(`Canvas dimensions set: ${canvas.width}x${canvas.height}`);
      
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
    
    // Render existing drawings with scale transformation
    existingDrawings.forEach((drawing, index) => {
      if (drawing.points.length < 2) {
        console.warn(`Drawing ${index} has less than 2 points, skipping`);
        return;
      }
      
      // Skip if no canvas dimensions are stored with the drawing
      if (!drawing.canvasDimensions) {
        console.warn(`Drawing ${index} has no canvas dimensions, using current dimensions`);
      }
      
      // Get the original canvas dimensions or use current ones as fallback
      const originalDimensions = drawing.canvasDimensions || {
        width: canvas.width / scale,
        height: canvas.height / scale
      };
      
      // Calculate the scale ratio between original and current canvas
      const widthRatio = canvas.width / (originalDimensions.width * scale);
      const heightRatio = canvas.height / (originalDimensions.height * scale);
      
      ctx.beginPath();
      
      // Transform the first point based on current scale and canvas dimensions
      const firstPoint = {
        x: drawing.points[0].x * scale * widthRatio,
        y: drawing.points[0].y * scale * heightRatio
      };
      
      ctx.moveTo(firstPoint.x, firstPoint.y);
      
      // Transform and draw the rest of the points
      for (let i = 1; i < drawing.points.length; i++) {
        const point = {
          x: drawing.points[i].x * scale * widthRatio,
          y: drawing.points[i].y * scale * heightRatio
        };
        ctx.lineTo(point.x, point.y);
      }
      
      ctx.strokeStyle = drawing.color;
      // Scale the line width with the zoom level for consistent appearance
      ctx.lineWidth = drawing.lineWidth * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
    
    console.log(`Rendered ${existingDrawings.length} drawings on page ${pageNumber} at scale ${scale}`);
  }, [scale, textLayerEnabled, existingDrawings, drawingColor, drawingLineWidth, pageNumber]);

  // Add this useEffect hook after the existing ones
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled) return;
    
    const canvas = canvasRef.current;
    
    const handleMouseEnter = () => {
      console.log('Mouse entered drawing canvas');
      // Force the cursor to be a crosshair
      canvas.style.cursor = 'crosshair';
    };
    
    const handleMouseLeave = () => {
      console.log('Mouse left drawing canvas');
    };
    
    canvas.addEventListener('mouseenter', handleMouseEnter);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      canvas.removeEventListener('mouseenter', handleMouseEnter);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [textLayerEnabled]);

  // Add this function at the beginning of the component
  const logMouseEvent = (event: string, e: React.MouseEvent<HTMLCanvasElement>) => {
    console.log(`Mouse ${event} at (${e.clientX}, ${e.clientY})`);
    console.log(`Text layer enabled: ${textLayerEnabled}`);
    console.log(`Is drawing: ${isDrawing}`);
    console.log(`Current scale: ${scale}`);
    if (canvasDimensions) {
      console.log(`Canvas dimensions: ${canvasDimensions.width}x${canvasDimensions.height} (at scale=1)`);
    }
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    logMouseEvent('down', e);
    
    if (textLayerEnabled) {
      console.log('Text layer enabled, ignoring drawing attempt');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.error('Canvas ref is null');
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
    
    console.log(`Starting drawing at (${x}, ${y}) with scale ${scale}`);
    setIsDrawing(true);
    setCurrentPath([{ x, y }]);
    
    // Start drawing
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
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
    
    logMouseEvent('move', e);
    
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
  
  const endDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || textLayerEnabled) return;
    
    logMouseEvent('up/leave', e);
    
    console.log(`Ending drawing with ${currentPath.length} points`);
    setIsDrawing(false);
    
    // Save drawing if there are at least 2 points
    if (currentPath.length >= 2 && onDrawingComplete && canvasDimensions) {
      console.log('Completing drawing and sending to parent');
      
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
      
      console.log('Drawing normalized to scale 1 for storage with canvas dimensions');
    } else {
      console.log('Drawing has less than 2 points or no callback provided');
    }
    
    // Reset current path
    setCurrentPath([]);
  };

  // Add this useEffect hook to log when textLayerEnabled changes
  useEffect(() => {
    console.log(`Text layer enabled changed to: ${textLayerEnabled}`);
  }, [textLayerEnabled]);

  // Update the render condition to be more explicit
  // Don't render if text layer is enabled
  if (textLayerEnabled) {
    console.log('DrawingComponent not rendering because text layer is enabled');
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
      style={{ cursor: 'crosshair' }} // Add inline style as a backup
    />
  );
};

export default DrawingComponent;
