import { TextCrossedOut } from '../../model/types/Drawings';
import { transformCoordinates } from '../rotationUtils';

/**
 * Renders a text crossed-out on the canvas
 */
export const renderTextCrossedOut = (
  ctx: CanvasRenderingContext2D,
  drawing: TextCrossedOut,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  ctx.beginPath();
  ctx.strokeStyle = drawing.style.strokeColor;
  ctx.lineWidth = drawing.style.strokeWidth * scale;
  ctx.setLineDash([]); // Solid line

  // Draw each line segment
  drawing.lines.forEach((line) => {
    // Transform start and end points with rotation
    const { x: startX, y: startY } = transformCoordinates(line.start.x, line.start.y, canvasWidth, canvasHeight, scale, rotation);

    const { x: endX, y: endY } = transformCoordinates(line.end.x, line.end.y, canvasWidth, canvasHeight, scale, rotation);

    // Draw a line from start to end for the crossed out text
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  });
};
