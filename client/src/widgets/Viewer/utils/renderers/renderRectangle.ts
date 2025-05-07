import { Rectangle } from '../../model/types/Drawings';
import { transformCoordinates } from '../rotationUtils';

/**
 * Renders a rectangle on the canvas
 */
export const renderRectangle = (
  ctx: CanvasRenderingContext2D,
  drawing: Rectangle,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  ctx.beginPath();
  ctx.strokeStyle = drawing.style.strokeColor;
  ctx.lineWidth = drawing.style.strokeWidth * scale;

  // Transform rectangle points with rotation
  const { x: rectStartX, y: rectStartY } = transformCoordinates(
    drawing.startPoint.x,
    drawing.startPoint.y,
    canvasWidth,
    canvasHeight,
    scale,
    rotation,
  );

  const { x: rectEndX, y: rectEndY } = transformCoordinates(
    drawing.endPoint.x,
    drawing.endPoint.y,
    canvasWidth,
    canvasHeight,
    scale,
    rotation,
  );

  const rectWidth = rectEndX - rectStartX;
  const rectHeight = rectEndY - rectStartY;

  ctx.strokeRect(rectStartX, rectStartY, rectWidth, rectHeight);
};
