import { Line } from '../../model/types/Drawings';
import { transformCoordinates } from '../rotationUtils';

/**
 * Renders a line drawing on the canvas
 */
export const renderLine = (
  ctx: CanvasRenderingContext2D,
  drawing: Line,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  // Draw each line in the lines array
  drawing.lines.forEach((line, lineIndex) => {
    // Get line-specific style if available, otherwise use the default style
    const lineStyle = drawing.lineStyles?.[lineIndex] || drawing.style;
    ctx.strokeStyle = lineStyle.strokeColor;
    ctx.lineWidth = lineStyle.strokeWidth * scale;
    ctx.lineCap = 'round';

    ctx.beginPath();

    // Transform line points with rotation
    const { x: lineStartX, y: lineStartY } = transformCoordinates(
      line.startPoint.x,
      line.startPoint.y,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    const { x: lineEndX, y: lineEndY } = transformCoordinates(
      line.endPoint.x,
      line.endPoint.y,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    ctx.moveTo(lineStartX, lineStartY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();
  });
};
