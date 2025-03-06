import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderPin } from '../../utils/pinRenderer';
import { RotationAngle } from '../../model/types/viewerSchema';
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
  
  // Filter drawings for this page
  const pageDrawings = drawings.filter(drawing => drawing.pageNumber === pageNumber);
  const pageRectangles = rectangles.filter(rect => rect.pageNumber === pageNumber);
  const pagePins = pins.filter(pin => pin.pageNumber === pageNumber);
  
  // Transform coordinates from 0 degrees to current rotation
  const transformCoordinates = (
    normalizedX: number, 
    normalizedY: number, 
    canvasWidth: number, 
    canvasHeight: number,
    drawingRotation: RotationAngle = 0
  ): { x: number, y: number } => {
    // Calculate center point
    const centerX = 0.5;
    const centerY = 0.5;
    
    // Translate to origin (center of canvas)
    const translatedX = normalizedX - centerX;
    const translatedY = normalizedY - centerY;
    
    // Apply rotation (from 0 degrees to current rotation)
    let rotatedX, rotatedY;
    
    // Calculate the rotation to apply (current rotation - drawing rotation)
    const rotationToApply = (rotation - drawingRotation + 360) % 360 as RotationAngle;
    
    if (rotationToApply === 90) {
      rotatedX = -translatedY;
      rotatedY = translatedX;
    } else if (rotationToApply === 180) {
      rotatedX = -translatedX;
      rotatedY = -translatedY;
    } else if (rotationToApply === 270) {
      rotatedX = translatedY;
      rotatedY = -translatedX;
    } else {
      // No rotation (0 degrees)
      rotatedX = translatedX;
      rotatedY = translatedY;
    }
    
    // Translate back from origin
    const finalX = (rotatedX + centerX) * canvasWidth;
    const finalY = (rotatedY + centerY) * canvasHeight;
    
    return { 
      x: finalX, 
      y: finalY 
    };
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
      ctx.lineWidth = drawing.lineWidth * scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Get the drawing's rotation (default to 0 if not specified)
      const drawingRotation = (drawing as any).rotation || 0;
      
      // Start from the first point with rotation transformation
      const startPoint = drawing.points[0];
      const { x: startX, y: startY } = transformCoordinates(
        startPoint.x, 
        startPoint.y, 
        canvas.width, 
        canvas.height,
        drawingRotation
      );
      
      ctx.moveTo(startX, startY);
      
      // Draw lines to each subsequent point with rotation transformation
      for (let i = 1; i < drawing.points.length; i++) {
        const point = drawing.points[i];
        const { x, y } = transformCoordinates(
          point.x, 
          point.y, 
          canvas.width, 
          canvas.height,
          drawingRotation
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
      
      // Get the rectangle's rotation (default to 0 if not specified)
      const rectRotation = (rect as any).rotation || 0;
      
      // Transform rectangle points with rotation
      const { x: startX, y: startY } = transformCoordinates(
        rect.startPoint.x, 
        rect.startPoint.y, 
        canvas.width, 
        canvas.height,
        rectRotation
      );
      
      const { x: endX, y: endY } = transformCoordinates(
        rect.endPoint.x, 
        rect.endPoint.y, 
        canvas.width, 
        canvas.height,
        rectRotation
      );
      
      const width = endX - startX;
      const height = endY - startY;
      
      ctx.strokeRect(startX, startY, width, height);
    });
    
    // Draw all pins
    pagePins.forEach(pin => {
      // Get the pin's rotation (default to 0 if not specified)
      const pinRotation = (pin as any).rotation || 0;
      
      // Transform pin position with rotation
      const { x, y } = transformCoordinates(
        pin.position.x, 
        pin.position.y, 
        canvas.width, 
        canvas.height,
        pinRotation
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