import { ExtensionLine } from '../model/types/Drawings';

// Constants from extensionLineRenderer.ts
const DEFAULT_ARROW_TAIL_LENGTH_FACTOR = 5;
const TEXT_FONT_SIZE = 11;
const TEXT_PADDING = 6;
const TEXT_BG_HEIGHT = 16;

/**
 * Calculates the actual bounding box of an extension line including its text
 * This ensures image capture includes the full rendered extension line
 */
export function calculateExtensionLineBoundingBox(
  extensionLine: ExtensionLine,
  canvasWidth: number,
  canvasHeight: number,
  ctx?: CanvasRenderingContext2D,
): { left: number; top: number; width: number; height: number } {
  const pinSize = 12;
  const padding = 20; // Additional padding around the entire extension line

  const pinX = extensionLine.position.x;
  const pinY = extensionLine.position.y;
  const bendX = extensionLine.bendPoint?.x || pinX;
  const bendY = extensionLine.bendPoint?.y || pinY;

  // Calculate tail length based on text width
  const defaultArrowTailLength = pinSize * DEFAULT_ARROW_TAIL_LENGTH_FACTOR;
  let requiredTextWidth = 0;

  if (extensionLine.text && extensionLine.text.length > 0 && ctx) {
    // Save current font
    const currentFont = ctx.font;
    ctx.font = `bold ${TEXT_FONT_SIZE}px Arial, sans-serif`;
    requiredTextWidth = ctx.measureText(extensionLine.text).width + TEXT_PADDING * 2;
    ctx.font = currentFont; // Restore original font
  } else if (extensionLine.text && extensionLine.text.length > 0) {
    // Fallback estimation if no context provided
    requiredTextWidth = extensionLine.text.length * 8 + TEXT_PADDING * 2;
  }

  const actualTailLength = Math.max(defaultArrowTailLength, requiredTextWidth);

  // Determine tail direction based on arrow direction
  const arrowDx = pinX - bendX;
  const tailDirection = arrowDx > 0 ? -1 : 1;

  // Calculate tail end position
  const tailEndX = bendX + tailDirection * actualTailLength;
  const tailEndY = bendY;

  // Calculate text position (for vertical bounds)
  const textY = bendY - pinSize * 0.8;

  // Find the extremes of all components
  const allX = [pinX, bendX, tailEndX];
  const allY = [pinY, bendY, tailEndY, textY - TEXT_BG_HEIGHT / 2, textY + TEXT_BG_HEIGHT / 2];

  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  // Calculate bounding box with padding
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(canvasWidth, maxX + padding);
  const bottom = Math.min(canvasHeight, maxY + padding);

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}
