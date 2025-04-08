import { ExtensionLine } from '../model/types/viewerSchema';

// Constants for pin rendering
const MAX_ARROW_HEAD_LENGTH = 15; // Maximum length of the arrow head

/**
 * Renders a pin on the canvas
 * @param ctx Canvas rendering context
 * @param pin Pin data to render
 * @param x X coordinate (scaled)
 * @param y Y coordinate (scaled)
 */
export const renderExtensionLine = (ctx: CanvasRenderingContext2D, extensionLine: ExtensionLine, x: number, y: number): void => {
  // Fixed sizes that don't scale with zoom
  const pinSize = 12;
  const arrowThickness = 3;

  // Save context for shadow
  ctx.save();

  // Add shadow for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Draw a thinner arrow with arrowhead
  ctx.fillStyle = extensionLine.color;

  // Calculate arrow dimensions
  const arrowHeadWidth = pinSize * 0.5; // Width of the arrowhead (thinner)
  const arrowTailLength = pinSize * 5; // Length of the tail

  // Use the bendPoint if provided, otherwise calculate a default bend point
  let bendX: number, bendY: number;

  if (extensionLine.bendPoint) {
    // If a bendPoint is provided, use it directly
    bendX = extensionLine.bendPoint.x;
    bendY = extensionLine.bendPoint.y;
  } else {
    // Fallback to the old calculation for backward compatibility
    const arrowLength = pinSize * 3; // Length of the diagonal pointing part
    const diagonalOffset = arrowLength / Math.sqrt(2); // Equal x and y offset for 45 degrees
    bendX = x - diagonalOffset;
    bendY = y - diagonalOffset;
  }

  // Calculate the vector from bend point to arrow tip
  const arrowDx = x - bendX;
  const arrowDy = y - bendY;

  // Avoid zero-length vectors
  if (arrowDx === 0 && arrowDy === 0) {
    // If bend point equals the arrow tip (shouldn't normally happen),
    // just use a horizontal tail to the left as fallback
    const tailEndX = bendX - arrowTailLength;
    const tailEndY = bendY;

    // Draw a simple horizontal arrow
    ctx.beginPath();
    ctx.lineWidth = arrowThickness;
    ctx.strokeStyle = extensionLine.color;
    ctx.lineCap = 'round';

    // Draw tail
    ctx.moveTo(tailEndX, tailEndY);
    ctx.lineTo(bendX, bendY);
    ctx.stroke();

    // Draw text
    if (extensionLine.text && extensionLine.text.length > 0) {
      renderArrowText(ctx, extensionLine, pinSize, arrowTailLength, bendX, bendY, tailEndX, tailEndY);
    }

    ctx.restore();
    return;
  }

  // Calculate the arrow length
  const arrowLength = Math.sqrt(arrowDx * arrowDx + arrowDy * arrowDy);

  // Normalize the arrow direction vector
  const normalizedArrowDx = arrowDx / arrowLength;
  const normalizedArrowDy = arrowDy / arrowLength;

  // Determine which direction the horizontal tail should go
  // Check if the arrow is pointing more to the left or right
  const tailDirection = arrowDx > 0 ? -1 : 1; // -1 for tail to left, 1 for tail to right

  // Always make the tail horizontal
  const tailEndX = bendX + tailDirection * arrowTailLength;
  const tailEndY = bendY; // Same Y as bend point to make it horizontal

  // Draw the arrow
  ctx.beginPath();
  ctx.lineWidth = arrowThickness;
  ctx.strokeStyle = extensionLine.color;
  ctx.lineCap = 'round';

  // Draw the tail (horizontal)
  ctx.moveTo(tailEndX, tailEndY);
  ctx.lineTo(bendX, bendY);

  // Calculate the length for the arrow head
  // Use the minimum of the actual arrow length and MAX_ARROW_HEAD_LENGTH
  const arrowHeadLength = Math.min(arrowLength * 0.2, MAX_ARROW_HEAD_LENGTH);

  // Calculate the ratio based on the constrained arrow head length
  const ratio = 1 - arrowHeadLength / arrowLength;

  // Calculate arrowhead base point
  const arrowHeadBaseX = bendX + normalizedArrowDx * arrowLength * ratio;
  const arrowHeadBaseY = bendY + normalizedArrowDy * arrowLength * ratio;

  // Draw the arrow shaft (from bend to arrowhead base)
  ctx.lineTo(arrowHeadBaseX, arrowHeadBaseY);
  ctx.stroke();

  // Draw the arrowhead
  ctx.beginPath();
  ctx.lineWidth = arrowThickness;
  ctx.strokeStyle = extensionLine.color;

  // Calculate the perpendicular vectors for the arrowhead sides
  const perpX = -normalizedArrowDy;
  const perpY = normalizedArrowDx;

  // Calculate the arrowhead points
  const leftX = arrowHeadBaseX + perpX * arrowHeadWidth;
  const leftY = arrowHeadBaseY + perpY * arrowHeadWidth;
  const rightX = arrowHeadBaseX - perpX * arrowHeadWidth;
  const rightY = arrowHeadBaseY - perpY * arrowHeadWidth;

  // Draw the arrowhead lines
  ctx.moveTo(x, y); // Arrow tip
  ctx.lineTo(leftX, leftY);
  ctx.moveTo(x, y);
  ctx.lineTo(rightX, rightY);
  ctx.stroke();

  // Restore context (remove shadow)
  ctx.restore();

  // Draw text on the tail
  if (extensionLine.text && extensionLine.text.length > 0) {
    renderArrowText(ctx, extensionLine, pinSize, arrowTailLength, bendX, bendY, tailEndX, tailEndY);
  }
};

/**
 * Renders text over the arrow tail
 * @param ctx Canvas rendering context
 * @param pin Pin data
 * @param pinSize Size of the pin
 * @param arrowTailLength Length of the arrow tail
 * @param bendX X coordinate of the bend point
 * @param bendY Y coordinate of the bend point
 * @param tailEndX X coordinate of the tail end point
 * @param _tailEndY Y coordinate of the tail end point (unused for horizontal tails)
 */
export const renderArrowText = (
  ctx: CanvasRenderingContext2D,
  extensionLine: ExtensionLine,
  pinSize: number,
  arrowTailLength: number,
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
  const fontSize = 11;
  const padding = 6;

  // Set font before measuring text
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;

  // Measure text width
  const textWidth = ctx.measureText(extensionLine.text).width;

  // Calculate the actual distance between bend and tail end
  const tailDistance = Math.abs(tailEndX - bendX); // For horizontal tail, just the X distance

  // Use the smaller of tail distance or arrowTailLength for constraints
  const effectiveTailLength = Math.min(tailDistance, arrowTailLength);
  const textBgWidth = Math.min(textWidth + padding * 2, effectiveTailLength * 0.9);
  const textBgHeight = 16;

  // Draw text background for better readability
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.roundRect(textX - textBgWidth / 2, textY - textBgHeight / 2, textBgWidth, textBgHeight, 4);
  ctx.fill();

  // Draw text
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // If text is too long, truncate it
  let displayText = extensionLine.text;
  if (textWidth > effectiveTailLength * 0.8) {
    // Calculate how many characters we can fit
    const charsPerWidth = extensionLine.text.length / textWidth;
    const maxChars = Math.floor(effectiveTailLength * 0.8 * charsPerWidth);
    displayText = extensionLine.text.substring(0, maxChars - 3) + '...';
  }

  ctx.fillText(displayText, textX, textY);
};
