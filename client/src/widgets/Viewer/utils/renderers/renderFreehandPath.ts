import { DrawingPath } from '../../model/types/Drawings';
import { transformCoordinates } from '../rotationUtils';

/**
 * Renders a freehand drawing path on the canvas
 */
export const renderFreehandPath = (
  ctx: CanvasRenderingContext2D,
  drawing: DrawingPath,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  // Draw each path in the paths array
  drawing.paths.forEach((path, pathIndex) => {
    if (path.length < 2) return;

    // Get path-specific style if available, otherwise use the default style
    const pathStyle = drawing.pathStyles?.[pathIndex] || drawing.style;
    ctx.strokeStyle = pathStyle.strokeColor;
    ctx.lineWidth = pathStyle.strokeWidth * scale; // Apply current scale to line width
    ctx.globalAlpha = pathStyle.opacity ?? 1;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();

    // Start from the first point with rotation transformation
    const startPoint = path[0];
    const { x: startX, y: startY } = transformCoordinates(startPoint.x, startPoint.y, canvasWidth, canvasHeight, scale, rotation);

    ctx.moveTo(startX, startY);

    // Draw lines to each subsequent point with rotation transformation
    for (let i = 1; i < path.length; i++) {
      const point = path[i];
      const { x, y } = transformCoordinates(point.x, point.y, canvasWidth, canvasHeight, scale, rotation);
      ctx.lineTo(x, y);
    }

    ctx.stroke();
  });
};
