import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
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
    
    // Draw all pins
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
      
      // Draw pin marker
      const pinSize = 12 * scale;
      
      // Draw pin icon (map marker shape)
      ctx.fillStyle = pin.color;
      
      // Draw the pin point (triangle)
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - pinSize, y - pinSize * 1.5);
      ctx.lineTo(x + pinSize, y - pinSize * 1.5);
      ctx.closePath();
      ctx.fill();
      
      // Draw a circle for the pin head
      ctx.beginPath();
      ctx.arc(x, y - pinSize * 1.5, pinSize, 0, Math.PI * 2);
      ctx.fill();
      
      // Draw pin text
      ctx.font = `${12 * scale}px Arial`;
      ctx.fillStyle = 'white';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Limit text length for display
      const displayText = pin.text.length > 3 ? pin.text.substring(0, 3) : pin.text;
      ctx.fillText(displayText, x, y - pinSize * 1.5);
      
      // Draw full text in a bubble if there's more text
      if (pin.text.length > 0) {
        const bubbleWidth = Math.max(100 * scale, pin.text.length * 7 * scale);
        const bubbleHeight = 30 * scale;
        
        // Draw bubble
        ctx.fillStyle = 'white';
        ctx.beginPath();
        
        // Use roundRect if available, otherwise use a regular rect
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(
            x - bubbleWidth / 2,
            y - pinSize * 4 - bubbleHeight,
            bubbleWidth,
            bubbleHeight,
            5 * scale
          );
        } else {
          // Fallback for browsers that don't support roundRect
          ctx.rect(
            x - bubbleWidth / 2,
            y - pinSize * 4 - bubbleHeight,
            bubbleWidth,
            bubbleHeight
          );
        }
        ctx.fill();
        
        // Draw bubble border
        ctx.strokeStyle = pin.color;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
        
        // Draw text in bubble
        ctx.fillStyle = '#333';
        ctx.font = `${11 * scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          pin.text,
          x,
          y - pinSize * 4 - bubbleHeight / 2
        );
        
        // Draw pointer from bubble to pin
        ctx.beginPath();
        ctx.fillStyle = 'white';
        ctx.moveTo(x - 8 * scale, y - pinSize * 4);
        ctx.lineTo(x, y - pinSize * 2);
        ctx.lineTo(x + 8 * scale, y - pinSize * 4);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = pin.color;
        ctx.lineWidth = 2 * scale;
        ctx.stroke();
      }
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