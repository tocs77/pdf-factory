import React, { useEffect, useRef } from 'react';
import { DrawingPath } from '../../model/types/viewerSchema';
import styles from './CompleteDrawings.module.scss';

interface CompleteDrawingsProps {
  scale: number;
  pageNumber: number;
  existingDrawings: DrawingPath[];
}

/**
 * Component to display completed drawings
 * This component is always visible, even when text layer is enabled
 */
const CompleteDrawings: React.FC<CompleteDrawingsProps> = ({
  scale,
  pageNumber,
  existingDrawings = []
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Set up canvas and render existing drawings
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
  }, [scale, existingDrawings, pageNumber]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.completedDrawingsCanvas}
      style={{ pointerEvents: 'none' }} // Make canvas non-interactive
    />
  );
};

export default CompleteDrawings; 