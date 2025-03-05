import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderPin } from '../../utils/pinRenderer';
import styles from './CompleteDrawings.module.scss';

interface CompleteDrawingsProps {
  pageNumber: number;
  scale: number;
}

/**
 * Component to display completed drawings and rectangles
 * This component is always visible, even when text layer is enabled
 */
const CompleteDrawings: React.FC<CompleteDrawingsProps> = ({ pageNumber, scale }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state } = useContext(ViewerContext);
  const { drawings, rectangles, pins } = state;
  
  // Filter drawings for this page
  const pageDrawings = drawings.filter(drawing => drawing.pageNumber === pageNumber);
  const pageRectangles = rectangles.filter(rect => rect.pageNumber === pageNumber);
  const pagePins = pins.filter(pin => pin.pageNumber === pageNumber);
  
  // Render drawings on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (!parent) {
      console.warn('No parent element found for canvas');
      return;
    }
    
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw all paths
    pageDrawings.forEach(drawing => {
      if (drawing.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = drawing.lineWidth * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Calculate scaling factor based on the original canvas dimensions
      // This ensures drawings maintain their position and size across different zoom levels
      let scaleX = 1;
      let scaleY = 1;
      
      if (drawing.canvasDimensions) {
        scaleX = canvas.width / (drawing.canvasDimensions.width * scale);
        scaleY = canvas.height / (drawing.canvasDimensions.height * scale);
      }
      
      // Start from the first point
      const startPoint = drawing.points[0];
      ctx.moveTo(startPoint.x * scale * scaleX, startPoint.y * scale * scaleY);
      
      // Draw lines to each subsequent point
      for (let i = 1; i < drawing.points.length; i++) {
        const point = drawing.points[i];
        ctx.lineTo(point.x * scale * scaleX, point.y * scale * scaleY);
      }
      
      ctx.stroke();
    });
    
    // Draw all rectangles
    pageRectangles.forEach(rect => {
      ctx.beginPath();
      ctx.strokeStyle = rect.color;
      ctx.lineWidth = rect.lineWidth * scale;
      
      // Calculate scaling factor based on the original canvas dimensions
      let scaleX = 1;
      let scaleY = 1;
      
      if (rect.canvasDimensions) {
        scaleX = canvas.width / (rect.canvasDimensions.width * scale);
        scaleY = canvas.height / (rect.canvasDimensions.height * scale);
      }
      
      const startX = rect.startPoint.x * scale * scaleX;
      const startY = rect.startPoint.y * scale * scaleY;
      const width = (rect.endPoint.x - rect.startPoint.x) * scale * scaleX;
      const height = (rect.endPoint.y - rect.startPoint.y) * scale * scaleY;
      
      ctx.strokeRect(startX, startY, width, height);
    });
    
    // Draw all pins using the pin renderer utility
    pagePins.forEach(pin => {
      // Calculate scaling factor based on the original canvas dimensions
      let scaleX = 1;
      let scaleY = 1;
      
      if (pin.canvasDimensions) {
        scaleX = canvas.width / (pin.canvasDimensions.width * scale);
        scaleY = canvas.height / (pin.canvasDimensions.height * scale);
      }
      
      const x = pin.position.x * scale * scaleX;
      const y = pin.position.y * scale * scaleY;
      
      // Use the pin renderer utility
      renderPin(ctx, pin, x, y);
    });
  }, [pageDrawings, pageRectangles, pagePins, scale, pageNumber]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingCanvas}
      data-testid="complete-drawings-canvas"
    />
  );
};

export default CompleteDrawings; 