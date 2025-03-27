import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderPin } from '../../utils/pinRenderer';
import { transformCoordinates } from '../../utils/rotationUtils';
import {
  renderFreehandPath,
  renderRectangle,
  renderLine,
  renderDrawArea,
  renderTextUnderline,
  renderTextCrossedOut,
  renderTextHighlight,
  renderTextArea,
} from '../../utils/drawingRenderers';
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

    // Draw all drawings based on their type using the appropriate renderer functions
    pageDrawings.forEach((drawing) => {
      switch (drawing.type) {
        case 'freehand':
          renderFreehandPath(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'rectangle':
          renderRectangle(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'pin': {
          // Transform pin position with rotation
          const { x, y } = transformCoordinates(
            drawing.position.x,
            drawing.position.y,
            canvas.width,
            canvas.height,
            scale,
            rotation,
          );

          // If there's a bend point, transform it too
          if (drawing.bendPoint) {
            const transformedBend = transformCoordinates(
              drawing.bendPoint.x,
              drawing.bendPoint.y,
              canvas.width,
              canvas.height,
              scale,
              rotation,
            );

            // Create a temporary pin with the transformed bend point
            const tempPin = {
              ...drawing,
              bendPoint: { x: transformedBend.x, y: transformedBend.y },
            };

            // Use the pin renderer utility with transformed coordinates
            renderPin(ctx, tempPin, x, y);
          } else {
            // Use the pin renderer utility with just the position
            renderPin(ctx, drawing, x, y);
          }
          break;
        }

        case 'line':
          renderLine(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'drawArea':
          renderDrawArea(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'textUnderline':
          renderTextUnderline(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'textCrossedOut':
          renderTextCrossedOut(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'textHighlight':
          renderTextHighlight(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'textArea':
          renderTextArea(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;
      }
    });
  }, [pageDrawings, scale, pageNumber, rotation]);

  return <canvas ref={canvasRef} className={styles.drawingsCanvas} data-testid='complete-drawings-canvas' />;
};

export default CompleteDrawings;
