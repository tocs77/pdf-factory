import { PinSelection } from '../../model/types/Drawings';
import { transformCoordinates } from '../rotationUtils';

/**
 * Renders a map-style pin icon on the canvas for pinSelection
 */
export const renderpinSelection = (
  ctx: CanvasRenderingContext2D,
  drawing: PinSelection,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  const pinSize = 20 * scale; // Size of the pin head
  const stemHeight = 10 * scale; // Height of the stem below the circle
  const pinColor = drawing.color || '#FF0000'; // Use drawing color or fallback to Red

  // Transform the pin's normalized position to canvas coordinates
  const { x, y } = transformCoordinates(drawing.position.x, drawing.position.y, canvasWidth, canvasHeight, scale, rotation);

  // Draw the pin shape (circle + stem/triangle)
  ctx.beginPath();
  ctx.fillStyle = pinColor;
  ctx.strokeStyle = '#000000'; // Black outline
  ctx.lineWidth = 1 * scale;

  // Draw the main circle part of the pin (head)
  // The position (x, y) is the tip, so center the circle above it
  ctx.arc(x, y - stemHeight - pinSize / 2, pinSize / 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Draw the stem/triangle part pointing to the location
  ctx.beginPath();
  ctx.moveTo(x, y); // Tip
  ctx.lineTo(x - pinSize / 4, y - stemHeight); // Bottom-left of head connection
  ctx.lineTo(x + pinSize / 4, y - stemHeight); // Bottom-right of head connection
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};
