import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderPin } from '../../utils/pinRenderer';
import styles from './CompleteDrawings.module.scss';

interface CompleteDrawingsProps {
  pageNumber: number;
}

/**
 * Component to display completed drawings and rectangles
 * This component is always visible, even when text layer is enabled
 */
const CompleteDrawings: React.FC<CompleteDrawingsProps> = ({ pageNumber }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state } = useContext(ViewerContext);
  const { drawings, rectangles, pins, scale, pageRotations } = state;
  
  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;
  console.log(state.drawings);
  
  
  // Filter drawings for this page
  const pageDrawings = drawings.filter(drawing => drawing.pageNumber === pageNumber);
  const pageRectangles = rectangles.filter(rect => rect.pageNumber === pageNumber);
  const pagePins = pins.filter(pin => pin.pageNumber === pageNumber);
  
  // Function to rotate a point around the center
  const rotatePoint = (
    x0: number,
    y0: number,
    xc: number,
    yc: number,
    theta: number
  ): { x: number; y: number } => {
    const radians = (theta * Math.PI) / 180;
    const x1 = (x0 - xc) * Math.cos(radians) - (y0 - yc) * Math.sin(radians) + xc;
    const y1 = (x0 - xc) * Math.sin(radians) + (y0 - yc) * Math.cos(radians) + yc;
    return { x: x1, y: y1 };
  };

  // Transform coordinates from scale 1 and rotation 0 to current scale and rotation
  const transformCoordinates = (
    normalizedX: number,
    normalizedY: number,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number, y: number } => {
    // First, apply the current scale
    const scaledX = normalizedX * canvasWidth;
    const scaledY = normalizedY * canvasHeight;

    // Center of the canvas
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    // Rotate the point around the center of the page
    return rotatePoint(scaledX, scaledY, centerX, centerY, rotation);
  };
  
  // Render drawings on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
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
    
    // Draw all paths
    pageDrawings.forEach(drawing => {
      if (drawing.points.length < 2) return;
      
      ctx.beginPath();
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = drawing.lineWidth * scale; // Apply current scale to line width
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Start from the first point with rotation transformation
      const startPoint = drawing.points[0];
      const { x: startX, y: startY } = transformCoordinates(
        startPoint.x, 
        startPoint.y, 
        canvas.width, 
        canvas.height
      );
      
      ctx.moveTo(startX, startY);
      
      // Draw lines to each subsequent point with rotation transformation
      for (let i = 1; i < drawing.points.length; i++) {
        const point = drawing.points[i];
        const { x, y } = transformCoordinates(
          point.x, 
          point.y, 
          canvas.width, 
          canvas.height
        );
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();
    });
    
    // Draw all rectangles
    pageRectangles.forEach(rect => {
      ctx.beginPath();
      ctx.strokeStyle = rect.color;
      ctx.lineWidth = rect.lineWidth * scale;
      
      // Transform rectangle points with rotation
      const { x: startX, y: startY } = transformCoordinates(
        rect.startPoint.x, 
        rect.startPoint.y, 
        canvas.width, 
        canvas.height
      );
      
      const { x: endX, y: endY } = transformCoordinates(
        rect.endPoint.x, 
        rect.endPoint.y, 
        canvas.width, 
        canvas.height
      );
      
      const width = endX - startX;
      const height = endY - startY;
      
      ctx.strokeRect(startX, startY, width, height);
    });
    
    // Draw all pins
    pagePins.forEach(pin => {
      // Transform pin position with rotation
      const { x, y } = transformCoordinates(
        pin.position.x, 
        pin.position.y, 
        canvas.width, 
        canvas.height
      );
      
      // Use the pin renderer utility
      renderPin(ctx, pin, x, y);
    });
  }, [pageDrawings, pageRectangles, pagePins, scale, pageNumber, rotation]);

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingsCanvas}
      data-testid="complete-drawings-canvas"
    />
  );
};

export default CompleteDrawings; 