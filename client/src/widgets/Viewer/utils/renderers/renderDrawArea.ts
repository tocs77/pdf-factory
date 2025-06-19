import { DrawArea, RectSelection } from '../../model/types/Drawings';
import { transformCoordinates } from '../rotationUtils';

/**
 * Renders a draw area on the canvas
 */
export const renderDrawArea = (
  ctx: CanvasRenderingContext2D,
  drawing: DrawArea | RectSelection,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  // Transform draw area coordinates with rotation
  const { x: areaStartX, y: areaStartY } = transformCoordinates(
    drawing.startPoint.x,
    drawing.startPoint.y,
    canvasWidth,
    canvasHeight,
    scale,
    rotation,
  );

  const { x: areaEndX, y: areaEndY } = transformCoordinates(
    drawing.endPoint.x,
    drawing.endPoint.y,
    canvasWidth,
    canvasHeight,
    scale,
    rotation,
  );

  const areaWidth = areaEndX - areaStartX;
  const areaHeight = areaEndY - areaStartY;

  // Set fill style with the same color but 0.3 opacity
  const strokeColor = drawing.style.strokeColor;

  // Convert hex color to rgba if it's a hex color
  let fillColor;
  if (strokeColor.startsWith('#')) {
    // Parse the hex color to get RGB values
    const r = Number.parseInt(strokeColor.slice(1, 3), 16);
    const g = Number.parseInt(strokeColor.slice(3, 5), 16);
    const b = Number.parseInt(strokeColor.slice(5, 7), 16);
    fillColor = `rgba(${r}, ${g}, ${b}, 0.3)`;
  } else {
    // If not hex, assume it's already rgba and try to modify the alpha
    fillColor = strokeColor.replace(/rgba?\(([^)]+)\)/, (match, params) => {
      const values = params.split(',');
      if (values.length >= 3) {
        return `rgba(${values[0]},${values[1]},${values[2]}, 0.3)`;
      }
      return match;
    });
  }

  ctx.fillStyle = fillColor;

  // Fill the rectangle first
  ctx.fillRect(areaStartX, areaStartY, areaWidth, areaHeight);

  // Draw border only (no fill) with the line width from the context
  ctx.strokeStyle = drawing.style.strokeColor;
  // Apply the line width from the context that was saved with the area
  ctx.lineWidth = drawing.style.strokeWidth * scale;
  ctx.globalAlpha = drawing.style.opacity ?? 1;
  ctx.strokeRect(areaStartX, areaStartY, areaWidth, areaHeight);
};
