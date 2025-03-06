import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import styles from './DrawingComponent.module.scss';

interface DrawingComponentProps {
  pageNumber: number;
}

/**
 * Component for handling the drawing process
 * This component is only visible when text layer is disabled
 */
const DrawingComponent: React.FC<DrawingComponentProps> = ({
  pageNumber
}) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, textLayerEnabled, pageRotations } = state;
  
  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;
  
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
      
      // Store current canvas dimensions at scale=1
      setCanvasDimensions({
        width: parent.clientWidth / scale, // Store normalized dimensions (at scale=1)
        height: parent.clientHeight / scale
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
    
    // Apply rotation transformation if needed
    if (rotation !== 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // If rotated 90 or 270 degrees, we need to adjust for the aspect ratio change
      if (rotation === 90 || rotation === 270) {
        ctx.translate(-centerY, -centerX);
      } else {
        ctx.translate(-centerX, -centerY);
      }
      
      ctx.restore();
    }
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
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    // Adjust coordinates for rotation
    if (rotation !== 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Translate to origin
      const translatedX = x - centerX;
      const translatedY = y - centerY;
      
      // Rotate in the opposite direction
      const angleRad = (-rotation * Math.PI) / 180;
      const rotatedX = translatedX * Math.cos(angleRad) - translatedY * Math.sin(angleRad);
      const rotatedY = translatedX * Math.sin(angleRad) + translatedY * Math.cos(angleRad);
      
      // Translate back
      x = rotatedX + centerX;
      y = rotatedY + centerY;
      
      // Adjust for aspect ratio change in 90/270 degree rotations
      if (rotation === 90 || rotation === 270) {
        // Swap x and y coordinates
        [x, y] = [y, x];
      }
    }
    
    // Update canvas dimensions
    const parent = canvas.parentElement;
    if (parent) {
      setCanvasDimensions({
        width: parent.clientWidth / scale,
        height: parent.clientHeight / scale
      });
    }
    
    setIsDrawing(true);
    setCurrentPath([{ x, y }]);
    
    // Start drawing
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    
    // Apply rotation transformation if needed
    if (rotation !== 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // If rotated 90 or 270 degrees, we need to adjust for the aspect ratio change
      if (rotation === 90 || rotation === 270) {
        ctx.translate(-centerY, -centerX);
      } else {
        ctx.translate(-centerX, -centerY);
      }
    }
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = drawingColor;
    // Apply scale to line width for consistent visual appearance
    ctx.lineWidth = drawingLineWidth * scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    if (rotation !== 0) {
      ctx.restore();
    }
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || textLayerEnabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;
    
    // Adjust coordinates for rotation
    if (rotation !== 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Translate to origin
      const translatedX = x - centerX;
      const translatedY = y - centerY;
      
      // Rotate in the opposite direction
      const angleRad = (-rotation * Math.PI) / 180;
      const rotatedX = translatedX * Math.cos(angleRad) - translatedY * Math.sin(angleRad);
      const rotatedY = translatedX * Math.sin(angleRad) + translatedY * Math.cos(angleRad);
      
      // Translate back
      x = rotatedX + centerX;
      y = rotatedY + centerY;
      
      // Adjust for aspect ratio change in 90/270 degree rotations
      if (rotation === 90 || rotation === 270) {
        // Swap x and y coordinates
        [x, y] = [y, x];
      }
    }
    
    // Add point to current path
    setCurrentPath(prev => [...prev, { x, y }]);
    
    // Draw line
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Apply rotation transformation if needed
    if (rotation !== 0) {
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((rotation * Math.PI) / 180);
      
      // If rotated 90 or 270 degrees, we need to adjust for the aspect ratio change
      if (rotation === 90 || rotation === 270) {
        ctx.translate(-centerY, -centerX);
      } else {
        ctx.translate(-centerX, -centerY);
      }
    }
    
    ctx.lineTo(x, y);
    ctx.stroke();
    
    if (rotation !== 0) {
      ctx.restore();
    }
  };
  
  const endDrawing = () => {
    if (!isDrawing || textLayerEnabled) return;
    
    setIsDrawing(false);
    
    // Save drawing if there are at least 2 points
    if (currentPath.length >= 2 && canvasDimensions) {
      // Normalize the points to scale=1 before saving to context
      const normalizedPoints = currentPath.map(point => ({
        x: point.x / scale,
        y: point.y / scale
      }));
      
      dispatch({
        type: 'addDrawing',
        payload: {
          points: normalizedPoints,
          color: drawingColor,
          lineWidth: drawingLineWidth,
          pageNumber,
          canvasDimensions // Store the canvas dimensions at scale=1
        }
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
