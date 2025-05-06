import { ExtensionLine } from '../model/types/Drawings';

// Constants for pin rendering
const MAX_ARROW_HEAD_LENGTH = 15; // Maximum length of the arrow head
const ARROW_HEAD_WIDTH_FACTOR = 0.4; // Relative width of arrowhead base to length
const ARROW_HEAD_LENGTH_FACTOR = 0.25; // Relative length of arrowhead to arrow segment length
const DEFAULT_ARROW_TAIL_LENGTH_FACTOR = 5; // Factor for default tail length relative to pinSize
const TEXT_FONT_SIZE = 11;
const TEXT_PADDING = 6;
const TEXT_BG_HEIGHT = 16;

/**
 * Renders a pin on the canvas
 * @param ctx Canvas rendering context
 * @param pin Pin data to render
 * @param x X coordinate (scaled)
 * @param y Y coordinate (scaled)
 */
export const renderExtensionLine = (ctx: CanvasRenderingContext2D, extensionLine: ExtensionLine, x: number, y: number): void => {
  // Fixed sizes that don't scale with zoom
  const pinSize = 12; // Used for fallback calculations and default tail length
  const arrowThickness = 1.5; // Thinner line width

  // Save context for shadow
  ctx.save();

  // Add shadow for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.strokeStyle = extensionLine.color;
  ctx.fillStyle = extensionLine.color; // For filled arrowhead
  ctx.lineWidth = arrowThickness;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Use the bendPoint if provided, otherwise calculate a default bend point
  let bendX: number, bendY: number;

  if (extensionLine.bendPoint) {
    // If a bendPoint is provided, use it directly
    bendX = extensionLine.bendPoint.x;
    bendY = extensionLine.bendPoint.y;
  } else {
    // Fallback to the old calculation for backward compatibility
    const defaultArrowLength = pinSize * 3; // Length of the diagonal pointing part
    const diagonalOffset = defaultArrowLength / Math.sqrt(2); // Equal x and y offset for 45 degrees
    bendX = x - diagonalOffset;
    bendY = y - diagonalOffset;
  }

  // Calculate the vector from bend point to arrow tip
  const arrowDx = x - bendX;
  const arrowDy = y - bendY;

  // --- Calculate Tail Length ---
  const defaultArrowTailLength = pinSize * DEFAULT_ARROW_TAIL_LENGTH_FACTOR;
  let requiredTextWidth = 0;
  if (extensionLine.text && extensionLine.text.length > 0) {
    // Temporarily set font to measure text accurately
    const currentFont = ctx.font;
    ctx.font = `bold ${TEXT_FONT_SIZE}px Arial, sans-serif`;
    requiredTextWidth = ctx.measureText(extensionLine.text).width + TEXT_PADDING * 2;
    ctx.font = currentFont; // Restore original font
  }
  // Tail must be at least the default length, but expand for text
  const actualTailLength = Math.max(defaultArrowTailLength, requiredTextWidth);

  // Avoid zero-length vectors (fallback drawing)
  if (arrowDx === 0 && arrowDy === 0) {
    // If bend point equals the arrow tip (shouldn't normally happen),
    // just use a horizontal tail to the left as fallback
    const tailEndX = bendX - actualTailLength; // Use calculated length
    const tailEndY = bendY;

    // Draw a simple horizontal arrow line (no head needed here)
    ctx.beginPath();
    ctx.moveTo(tailEndX, tailEndY);
    ctx.lineTo(bendX, bendY);
    ctx.stroke();

    // Draw text (if any)
    if (extensionLine.text && extensionLine.text.length > 0) {
      renderArrowText(ctx, extensionLine, pinSize, bendX, bendY, tailEndX, tailEndY);
    }

    ctx.restore();
    return;
  }

  // Calculate the arrow length (from bend to tip)
  const arrowLength = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);

  // Normalize the arrow direction vector
  const normalizedArrowDx = arrowDx / arrowLength;
  const normalizedArrowDy = arrowDy / arrowLength;

  // Determine which direction the horizontal tail should go
  const tailDirection = arrowDx > 0 ? -1 : 1; // -1 for tail to left, 1 for tail to right

  // Always make the tail horizontal
  const tailEndX = bendX + tailDirection * actualTailLength; // Use actual length
  const tailEndY = bendY; // Same Y as bend point to make it horizontal

  // --- Draw Tail and Arrow Shaft ---
  ctx.beginPath();

  // Draw the tail (horizontal)
  ctx.moveTo(tailEndX, tailEndY);
  ctx.lineTo(bendX, bendY);

  // Calculate the arrowhead size based on the arrow segment length
  const arrowHeadLength = Math.min(arrowLength * ARROW_HEAD_LENGTH_FACTOR, MAX_ARROW_HEAD_LENGTH);
  const arrowHeadWidth = arrowHeadLength * ARROW_HEAD_WIDTH_FACTOR;

  // Calculate arrowhead base point (point on the line where the head starts)
  // Subtract the arrowhead length from the tip along the normalized vector
  const arrowHeadBaseX = x - normalizedArrowDx * arrowHeadLength;
  const arrowHeadBaseY = y - normalizedArrowDy * arrowHeadLength;

  // Draw the arrow shaft (from bend to arrowhead base)
  // Ensure shaft doesn't overlap the head visually
  if (arrowLength > arrowHeadLength) {
    ctx.lineTo(arrowHeadBaseX, arrowHeadBaseY);
  }
  // If arrow is shorter than head length, lineTo(bendX, bendY) was the last point

  // Stroke the tail and shaft together
  ctx.stroke();

  // --- Draw the Filled Arrowhead ---
  if (arrowLength >= 0.1) {
    // Only draw head if arrow has some length
    ctx.beginPath();
    ctx.moveTo(x, y); // Tip of the arrow

    // Calculate the perpendicular vector for arrowhead width
    const perpX = -normalizedArrowDy;
    const perpY = normalizedArrowDx;

    // Calculate the two base points of the arrowhead triangle
    const baseX1 = arrowHeadBaseX + perpX * arrowHeadWidth;
    const baseY1 = arrowHeadBaseY + perpY * arrowHeadWidth;
    const baseX2 = arrowHeadBaseX - perpX * arrowHeadWidth;
    const baseY2 = arrowHeadBaseY - perpY * arrowHeadWidth;

    // Draw the triangle
    ctx.lineTo(baseX1, baseY1);
    ctx.lineTo(baseX2, baseY2);
    ctx.closePath(); // Close the path to form a triangle

    ctx.fill(); // Fill the arrowhead
  }

  // Restore context (remove shadow)
  ctx.restore();

  // Draw text on the tail
  if (extensionLine.text && extensionLine.text.length > 0) {
    renderArrowText(ctx, extensionLine, pinSize, bendX, bendY, tailEndX, tailEndY);
  }
};

/**
 * Renders text over the arrow tail
 * @param ctx Canvas rendering context
 * @param pin Pin data
 * @param pinSize Size of the pin
 * @param bendX X coordinate of the bend point
 * @param bendY Y coordinate of the bend point
 * @param tailEndX X coordinate of the tail end point
 * @param _tailEndY Y coordinate of the tail end point (unused for horizontal tails)
 */
export const renderArrowText = (
  ctx: CanvasRenderingContext2D,
  extensionLine: ExtensionLine,
  pinSize: number,
  bendX: number,
  bendY: number,
  tailEndX: number,
  _tailEndY: number, // Kept for API compatibility
): void => {
  // Check for empty text
  if (!extensionLine.text || extensionLine.text.trim().length === 0) return;

  // Calculate text position (centered over the horizontal tail)
  const textX = (bendX + tailEndX) / 2;

  // Position above the tail
  const textY = bendY - pinSize * 0.8;

  // Fixed font size that doesn't scale with zoom
  // const fontSize = 11; // Use constant
  // const padding = 6; // Use constant

  // Set font before measuring text
  ctx.font = `bold ${TEXT_FONT_SIZE}px Arial, sans-serif`;

  // Measure text width
  const textWidth = ctx.measureText(extensionLine.text).width;

  // Calculate background width based directly on text width and padding
  const textBgWidth = textWidth + TEXT_PADDING * 2;
  // const textBgHeight = 16; // Use constant

  // Draw text background for better readability
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.roundRect(textX - textBgWidth / 2, textY - TEXT_BG_HEIGHT / 2, textBgWidth, TEXT_BG_HEIGHT, 4);
  ctx.fill();

  // Draw text
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // No truncation needed as tail length is adjusted
  ctx.fillText(extensionLine.text, textX, textY);
};
