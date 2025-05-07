import { TextHighlight } from '../../model/types/Drawings';
import { transformCoordinates } from '../rotationUtils';

/**
 * Renders a text highlight on the canvas
 */
export const renderTextHighlight = (
  ctx: CanvasRenderingContext2D,
  drawing: TextHighlight,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  // Set semi-transparent fill for highlighting
  const baseColor = drawing.style.strokeColor;
  // Default to 50% opacity if not specified
  let fillColor = baseColor + '80';

  if (drawing.opacity !== undefined) {
    // If opacity is specified in the drawing, use that instead
    const hexOpacity = Math.round(drawing.opacity * 255)
      .toString(16)
      .padStart(2, '0');
    fillColor = baseColor + hexOpacity;
  }

  ctx.fillStyle = fillColor;

  // Draw each rectangle for highlighting
  drawing.rects.forEach((rect) => {
    // Transform rectangle coordinates with rotation
    const { x: rectX, y: rectY } = transformCoordinates(rect.x, rect.y, canvasWidth, canvasHeight, scale, rotation);

    // For proper rotation handling, we need to transform all four corners of the rectangle
    // and then calculate the correct dimensions and position
    const topLeft = { x: rectX, y: rectY };

    // Transform the bottom-right corner
    const { x: rectBottomRightX, y: rectBottomRightY } = transformCoordinates(
      rect.x + rect.width,
      rect.y + rect.height,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    // Calculate the correct width and height after rotation
    let rectWidth, rectHeight;

    // For 90° and 270° rotations, width and height are essentially swapped
    // after the transformation
    if (rotation === 90 || rotation === 270) {
      // In these rotations, the transformed points create a rectangle
      // where width and height are swapped
      rectWidth = Math.abs(rectBottomRightY - topLeft.y);
      rectHeight = Math.abs(rectBottomRightX - topLeft.x);

      // Adjust starting point to account for the rotation
      const adjustedX = Math.min(topLeft.x, rectBottomRightX);
      const adjustedY = Math.min(topLeft.y, rectBottomRightY);

      ctx.fillRect(adjustedX, adjustedY, rectHeight, rectWidth);
    } else {
      // For 0° and 180° rotations, width and height remain as is
      rectWidth = Math.abs(rectBottomRightX - topLeft.x);
      rectHeight = Math.abs(rectBottomRightY - topLeft.y);

      // Adjust starting point to account for the rotation
      const adjustedX = Math.min(topLeft.x, rectBottomRightX);
      const adjustedY = Math.min(topLeft.y, rectBottomRightY);

      ctx.fillRect(adjustedX, adjustedY, rectWidth, rectHeight);
    }
  });
};
