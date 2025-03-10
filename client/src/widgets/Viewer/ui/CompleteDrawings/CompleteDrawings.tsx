import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderPin } from '../../utils/pinRenderer';
import { transformCoordinates } from '../../utils/rotationUtils';
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
  const { drawings, rectangles, pins, lines, scale, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  // Filter drawings for this page
  const pageDrawings = drawings.filter((drawing) => drawing.pageNumber === pageNumber);
  const pageRectangles = rectangles.filter((rect) => rect.pageNumber === pageNumber);
  const pagePins = pins.filter((pin) => pin.pageNumber === pageNumber);
  const pageLines = lines.filter((line) => line.pageNumber === pageNumber);

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
    pageDrawings.forEach((drawing) => {
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
        canvas.height,
        scale,
        rotation
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
          scale,
          rotation
        );
        ctx.lineTo(x, y);
      }

      ctx.stroke();
    });

    // Draw all rectangles
    pageRectangles.forEach((rect) => {
      ctx.beginPath();
      ctx.strokeStyle = rect.color;
      ctx.lineWidth = rect.lineWidth * scale;

      // Transform rectangle points with rotation
      const { x: startX, y: startY } = transformCoordinates(
        rect.startPoint.x, 
        rect.startPoint.y, 
        canvas.width, 
        canvas.height,
        scale,
        rotation
      );

      const { x: endX, y: endY } = transformCoordinates(
        rect.endPoint.x, 
        rect.endPoint.y, 
        canvas.width, 
        canvas.height,
        scale,
        rotation
      );

      const width = endX - startX;
      const height = endY - startY;

      ctx.strokeRect(startX, startY, width, height);
    });

    // Draw all lines
    pageLines.forEach((line) => {
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.lineWidth * scale;
      ctx.lineCap = 'round';

      // Transform line points with rotation
      const { x: startX, y: startY } = transformCoordinates(
        line.startPoint.x, 
        line.startPoint.y, 
        canvas.width, 
        canvas.height,
        scale,
        rotation
      );

      const { x: endX, y: endY } = transformCoordinates(
        line.endPoint.x, 
        line.endPoint.y, 
        canvas.width, 
        canvas.height,
        scale,
        rotation
      );

      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });

    // Draw all pins
    pagePins.forEach((pin) => {
      // Transform pin position with rotation
      const { x, y } = transformCoordinates(
        pin.position.x, 
        pin.position.y, 
        canvas.width, 
        canvas.height,
        scale,
        rotation
      );

      // Use the pin renderer utility
      renderPin(ctx, pin, x, y);
    });
  }, [pageDrawings, pageRectangles, pagePins, pageLines, scale, pageNumber, rotation]);

  return <canvas ref={canvasRef} className={styles.drawingsCanvas} data-testid='complete-drawings-canvas' />;
};

export default CompleteDrawings;
