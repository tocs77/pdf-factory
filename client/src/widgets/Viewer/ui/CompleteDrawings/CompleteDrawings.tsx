import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderPin } from '../../utils/pinRenderer';
import { transformCoordinates } from '../../utils/rotationUtils';
import { Drawing } from '../../model/types/viewerSchema';
import styles from './CompleteDrawings.module.scss';

interface CompleteDrawingsProps {
  pageNumber: number;
  drawings: Drawing[];
}

/**
 * Component to display completed drawings and rectangles
 * This component is always visible, even when text layer is enabled
 */
const CompleteDrawings: React.FC<CompleteDrawingsProps> = ({ pageNumber, drawings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { state } = useContext(ViewerContext);
  const { scale, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  // Filter drawings for this page
  const pageDrawings = drawings.filter((drawing) => drawing.pageNumber === pageNumber);

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

    // Draw all drawings based on their type
    pageDrawings.forEach((drawing) => {
      switch (drawing.type) {
        case 'freehand': {
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
          break;
        }

        case 'rectangle': {
          ctx.beginPath();
          ctx.strokeStyle = drawing.color;
          ctx.lineWidth = drawing.lineWidth * scale;

          // Transform rectangle points with rotation
          const { x: rectStartX, y: rectStartY } = transformCoordinates(
            drawing.startPoint.x, 
            drawing.startPoint.y, 
            canvas.width, 
            canvas.height,
            scale,
            rotation
          );

          const { x: rectEndX, y: rectEndY } = transformCoordinates(
            drawing.endPoint.x, 
            drawing.endPoint.y, 
            canvas.width, 
            canvas.height,
            scale,
            rotation
          );

          const rectWidth = rectEndX - rectStartX;
          const rectHeight = rectEndY - rectStartY;

          ctx.strokeRect(rectStartX, rectStartY, rectWidth, rectHeight);
          break;
        }

        case 'pin': {
          // Transform pin position with rotation
          const { x, y } = transformCoordinates(
            drawing.position.x, 
            drawing.position.y, 
            canvas.width, 
            canvas.height,
            scale,
            rotation
          );

          // If there's a bend point, transform it too
          if (drawing.bendPoint) {
            const transformedBend = transformCoordinates(
              drawing.bendPoint.x, 
              drawing.bendPoint.y, 
              canvas.width, 
              canvas.height,
              scale,
              rotation
            );
            
            // Create a temporary pin with the transformed bend point
            const tempPin = {
              ...drawing,
              bendPoint: { x: transformedBend.x, y: transformedBend.y }
            };
            
            // Use the pin renderer utility with transformed coordinates
            renderPin(ctx, tempPin, x, y);
          } else {
            // Use the pin renderer utility with just the position
            renderPin(ctx, drawing, x, y);
          }
          break;
        }

        case 'line': {
          ctx.beginPath();
          ctx.strokeStyle = drawing.color;
          ctx.lineWidth = drawing.lineWidth * scale;
          ctx.lineCap = 'round';

          // Transform line points with rotation
          const { x: lineStartX, y: lineStartY } = transformCoordinates(
            drawing.startPoint.x, 
            drawing.startPoint.y, 
            canvas.width, 
            canvas.height,
            scale,
            rotation
          );

          const { x: lineEndX, y: lineEndY } = transformCoordinates(
            drawing.endPoint.x, 
            drawing.endPoint.y, 
            canvas.width, 
            canvas.height,
            scale,
            rotation
          );

          ctx.moveTo(lineStartX, lineStartY);
          ctx.lineTo(lineEndX, lineEndY);
          ctx.stroke();
          break;
        }

        case 'drawArea': {
          // Transform draw area coordinates with rotation
          const { x: areaStartX, y: areaStartY } = transformCoordinates(
            drawing.startPoint.x, 
            drawing.startPoint.y, 
            canvas.width, 
            canvas.height,
            scale,
            rotation
          );

          const { x: areaEndX, y: areaEndY } = transformCoordinates(
            drawing.endPoint.x, 
            drawing.endPoint.y, 
            canvas.width, 
            canvas.height,
            scale,
            rotation
          );

          const areaWidth = areaEndX - areaStartX;
          const areaHeight = areaEndY - areaStartY;

          // Draw border only (no fill) with the line width from the context
          ctx.strokeStyle = drawing.color;
          // Apply the line width from the context that was saved with the area
          ctx.lineWidth = drawing.lineWidth * scale;
          ctx.strokeRect(areaStartX, areaStartY, areaWidth, areaHeight);
          break;
        }
        
        case 'textUnderline': {
          ctx.beginPath();
          ctx.strokeStyle = drawing.color;
          ctx.lineWidth = drawing.lineWidth * scale;
          ctx.setLineDash([]); // Solid line
          
          // Draw each line segment
          drawing.lines.forEach(line => {
            // Transform start and end points with rotation
            const { x: startX, y: startY } = transformCoordinates(
              line.start.x, 
              line.start.y, 
              canvas.width, 
              canvas.height,
              scale,
              rotation
            );

            const { x: endX, y: endY } = transformCoordinates(
              line.end.x, 
              line.end.y, 
              canvas.width, 
              canvas.height,
              scale,
              rotation
            );
            
            // Draw the underline
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          });
          
          break;
        }
      }
    });
  }, [pageDrawings, scale, pageNumber, rotation]);

  return <canvas ref={canvasRef} className={styles.drawingsCanvas} data-testid='complete-drawings-canvas' />;
};

export default CompleteDrawings;
