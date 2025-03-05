import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import styles from './DrawRect.module.scss';

interface DrawRectProps {
  pageNumber: number;
}

/**
 * Component for drawing rectangles
 * This component is only visible when text layer is disabled and drawing mode is 'rectangle'
 */
const DrawRect: React.FC<DrawRectProps> = ({
  pageNumber
}) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, textLayerEnabled } = state;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
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
  }, [scale, textLayerEnabled, pageNumber]);

  // Set cursor to crosshair
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled) return;
    
    const canvas = canvasRef.current;
    canvas.style.cursor = 'crosshair';
    
    return () => {
      canvas.style.cursor = '';
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
    
    // Update canvas dimensions
    const parent = canvas.parentElement;
    if (parent) {
      setCanvasDimensions({
        width: parent.clientWidth / scale,
        height: parent.clientHeight / scale
      });
    }
    
    setIsDrawing(true);
    setStartPoint({ x, y });
    setEndPoint({ x, y });
  };
  
  const drawRectangle = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || textLayerEnabled || !startPoint) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update end point
    setEndPoint({ x, y });
    
    // Draw rectangle
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate rectangle dimensions
    const width = x - startPoint.x;
    const height = y - startPoint.y;
    
    // Set drawing style
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth * scale;
    
    // Draw rectangle
    ctx.beginPath();
    ctx.rect(startPoint.x, startPoint.y, width, height);
    ctx.stroke();
  };
  
  const endDrawing = () => {
    if (!isDrawing || textLayerEnabled || !startPoint || !endPoint) return;
    
    setIsDrawing(false);
    
    // Only save if the rectangle has a non-zero area
    if (startPoint.x !== endPoint.x && startPoint.y !== endPoint.y && canvasDimensions) {
      // Normalize the points to scale=1 before saving
      const normalizedStartPoint = {
        x: startPoint.x / scale,
        y: startPoint.y / scale
      };
      
      const normalizedEndPoint = {
        x: endPoint.x / scale,
        y: endPoint.y / scale
      };
      
      dispatch({
        type: 'addRectangle',
        payload: {
          startPoint: normalizedStartPoint,
          endPoint: normalizedEndPoint,
          color: drawingColor,
          lineWidth: drawingLineWidth,
          pageNumber,
          canvasDimensions
        }
      });
    }
    
    // Reset points
    setStartPoint(null);
    setEndPoint(null);
    
    // Clear canvas
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // Don't render if text layer is enabled
  if (textLayerEnabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      className={styles.rectCanvas}
      onMouseDown={startDrawing}
      onMouseMove={drawRectangle}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
    />
  );
};

export default DrawRect; 