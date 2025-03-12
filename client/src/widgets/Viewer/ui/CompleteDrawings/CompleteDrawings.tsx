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
          ctx.strokeStyle = drawing.color;
          ctx.lineWidth = drawing.lineWidth * scale; // Apply current scale to line width
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          // Draw each path in the paths array
          for (const path of drawing.paths) {
            if (path.length < 2) continue;

            ctx.beginPath();
            
            // Start from the first point with rotation transformation
            const startPoint = path[0];
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
            for (let i = 1; i < path.length; i++) {
              const point = path[i];
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
          }
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
          ctx.strokeStyle = drawing.color;
          ctx.lineWidth = drawing.lineWidth * scale;
          ctx.lineCap = 'round';

          // Draw each line in the lines array
          for (const line of drawing.lines) {
            ctx.beginPath();
            
            // Transform line points with rotation
            const { x: lineStartX, y: lineStartY } = transformCoordinates(
              line.startPoint.x, 
              line.startPoint.y, 
              canvas.width, 
              canvas.height,
              scale,
              rotation
            );

            const { x: lineEndX, y: lineEndY } = transformCoordinates(
              line.endPoint.x, 
              line.endPoint.y, 
              canvas.width, 
              canvas.height,
              scale,
              rotation
            );

            ctx.moveTo(lineStartX, lineStartY);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.stroke();
          }
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
            
            // Draw a line from start to end for the underline
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          });
          break;
        }
        
        case 'textCrossedOut': {
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
            
            // Draw a line from start to end for the crossed out text
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          });
          break;
        }
        
        case 'textHighlight': {
          // Set semi-transparent fill for highlighting
          ctx.fillStyle = drawing.color + '80'; // Add 50% opacity
          if (drawing.opacity) {
            // If opacity is specified in the drawing, use that instead
            const hexOpacity = Math.round(drawing.opacity * 255).toString(16).padStart(2, '0');
            ctx.fillStyle = drawing.color + hexOpacity;
          }
          
          // Draw each rectangle for highlighting
          drawing.rects.forEach(rect => {
            // Transform rectangle coordinates with rotation
            const { x: rectX, y: rectY } = transformCoordinates(
              rect.x, 
              rect.y, 
              canvas.width, 
              canvas.height,
              scale,
              rotation
            );
            
            // For proper rotation handling, we need to transform all four corners of the rectangle
            // and then calculate the correct dimensions and position
            const topLeft = { x: rectX, y: rectY };
            
            // Transform the bottom-right corner
            const { x: rectBottomRightX, y: rectBottomRightY } = transformCoordinates(
              rect.x + rect.width, 
              rect.y + rect.height, 
              canvas.width, 
              canvas.height,
              scale,
              rotation
            );

            // Calculate the correct width and height after rotation
            let rectWidth, rectHeight;
            
            // For 90° and 270° rotations, width and height are essentially swapped
            // after the transformation
            if (rotation === 90 || rotation === 270) {
              // In these rotations, the transformed points create a rectangle
              // where width and height are different from the original
              rectWidth = Math.abs(rectBottomRightY - topLeft.y);
              rectHeight = Math.abs(rectBottomRightX - topLeft.x);
              
              // Draw the rectangle using swapped width and height
              ctx.fillRect(
                Math.min(topLeft.x, rectBottomRightX), 
                Math.min(topLeft.y, rectBottomRightY), 
                rectHeight,
                rectWidth
              );
            } else {
              // For 0° and 180° rotations, width and height remain conceptually the same
              // but we still need to calculate based on transformed corners
              rectWidth = Math.abs(rectBottomRightX - topLeft.x);
              rectHeight = Math.abs(rectBottomRightY - topLeft.y);
              
              // We need to use the minimum coordinates as the starting point
              // because the transformation might flip the rectangle
              ctx.fillRect(
                Math.min(topLeft.x, rectBottomRightX), 
                Math.min(topLeft.y, rectBottomRightY), 
                rectWidth,
                rectHeight
              );
            }
          });
          break;
        }
      }
    });
  }, [pageDrawings, scale, pageNumber, rotation]);

  return <canvas ref={canvasRef} className={styles.drawingsCanvas} data-testid='complete-drawings-canvas' />;
};

export default CompleteDrawings;
