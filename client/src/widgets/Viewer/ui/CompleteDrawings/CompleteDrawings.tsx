import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderPin } from '../../utils/pinRenderer';
import styles from './CompleteDrawings.module.scss';

interface CompleteDrawingsProps {
  pageNumber: number;
  scale: number;
  rotation: number;
}

/**
 * Component to display completed drawings and rectangles
 * This component is always visible, even when text layer is enabled
 */
const CompleteDrawings: React.FC<CompleteDrawingsProps> = ({ pageNumber, scale, rotation }) => {
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
    
    // For rotated pages (90 or 270 degrees), we need to adjust dimensions
    const isRotated90or270 = rotation === 90 || rotation === 270;
    
    // Set canvas dimensions
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    
    // Log rotation status for debugging
    if (isRotated90or270) {
      console.log(`Page ${pageNumber} is rotated to ${rotation} degrees, adjusting rendering`);
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Apply rotation transformation
    ctx.save();
    
    // Translate to center, rotate, and translate back
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    
    // If rotated 90 or 270 degrees, we need to adjust for the aspect ratio change
    if (rotation === 90 || rotation === 270) {
      // Swap width and height for the coordinate system
      ctx.translate(-centerY, -centerX);
    } else {
      ctx.translate(-centerX, -centerY);
    }
    
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
        // Adjust scaling based on rotation
        if (rotation === 90 || rotation === 270) {
          // For 90/270 degree rotations, swap width and height
          scaleX = canvas.height / (drawing.canvasDimensions.width * scale);
          scaleY = canvas.width / (drawing.canvasDimensions.height * scale);
        } else {
          scaleX = canvas.width / (drawing.canvasDimensions.width * scale);
          scaleY = canvas.height / (drawing.canvasDimensions.height * scale);
        }
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
        // Adjust scaling based on rotation
        if (rotation === 90 || rotation === 270) {
          // For 90/270 degree rotations, swap width and height
          scaleX = canvas.height / (rect.canvasDimensions.width * scale);
          scaleY = canvas.width / (rect.canvasDimensions.height * scale);
        } else {
          scaleX = canvas.width / (rect.canvasDimensions.width * scale);
          scaleY = canvas.height / (rect.canvasDimensions.height * scale);
        }
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
        // Adjust scaling based on rotation
        if (rotation === 90 || rotation === 270) {
          // For 90/270 degree rotations, swap width and height
          scaleX = canvas.height / (pin.canvasDimensions.width * scale);
          scaleY = canvas.width / (pin.canvasDimensions.height * scale);
        } else {
          scaleX = canvas.width / (pin.canvasDimensions.width * scale);
          scaleY = canvas.height / (pin.canvasDimensions.height * scale);
        }
      }
      
      const x = pin.position.x * scale * scaleX;
      const y = pin.position.y * scale * scaleY;
      
      // Use the pin renderer utility
      renderPin(ctx, pin, x, y);
    });
    
    // Restore the context to remove rotation
    ctx.restore();
  }, [pageDrawings, pageRectangles, pagePins, scale, pageNumber, rotation]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingCanvas}
      data-testid="complete-drawings-canvas"
    />
  );
};

export default CompleteDrawings; 