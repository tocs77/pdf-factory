import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import styles from './CompleteDrawings.module.scss';

interface CompleteDrawingsProps {
  pageNumber: number;
}

/**
 * Component to display completed drawings and rectangles
 * This component is always visible, even when text layer is enabled
 */
const CompleteDrawings: React.FC<CompleteDrawingsProps> = ({
  pageNumber
}) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawings, rectangles } = state;
  
  // Filter drawings and rectangles for this page
  const existingDrawings = drawings.filter(drawing => drawing.pageNumber === pageNumber);
  const existingRectangles = rectangles.filter(rect => rect.pageNumber === pageNumber);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Set up canvas and render existing drawings and rectangles
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    
    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    } else {
      console.warn('No parent element found for canvas');
      return;
    }
    
    // Clear canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Filter drawings for this page
    const pageDrawings = existingDrawings.filter(drawing => drawing.pageNumber === pageNumber);
    
    // Render existing drawings with scale transformation
    pageDrawings.forEach((drawing) => {
      if (drawing.points.length < 2) {
        return;
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
    
    // Filter rectangles for this page
    const pageRectangles = existingRectangles.filter(rect => rect.pageNumber === pageNumber);
    
    // Render existing rectangles with scale transformation
    pageRectangles.forEach((rect) => {
      // Get the original canvas dimensions or use current ones as fallback
      const originalDimensions = rect.canvasDimensions || {
        width: canvas.width / scale,
        height: canvas.height / scale
      };
      
      // Calculate the scale ratio between original and current canvas
      const widthRatio = canvas.width / (originalDimensions.width * scale);
      const heightRatio = canvas.height / (originalDimensions.height * scale);
      
      // Transform the points based on current scale and canvas dimensions
      const startPoint = {
        x: rect.startPoint.x * scale * widthRatio,
        y: rect.startPoint.y * scale * heightRatio
      };
      
      const endPoint = {
        x: rect.endPoint.x * scale * widthRatio,
        y: rect.endPoint.y * scale * heightRatio
      };
      
      // Calculate width and height
      const width = endPoint.x - startPoint.x;
      const height = endPoint.y - startPoint.y;
      
      // Draw the rectangle
      ctx.beginPath();
      ctx.rect(startPoint.x, startPoint.y, width, height);
      ctx.strokeStyle = rect.color;
      ctx.lineWidth = rect.lineWidth * scale;
      ctx.stroke();
    });
  }, [scale, existingDrawings, existingRectangles, pageNumber]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.completedDrawingsCanvas}
      style={{ pointerEvents: 'none' }} // Make canvas non-interactive
    />
  );
};

export default CompleteDrawings; 