import { Pin } from '../model/types/viewerSchema';

/**
 * Renders a pin on the canvas
 * @param ctx Canvas rendering context
 * @param pin Pin data to render
 * @param x X coordinate (scaled)
 * @param y Y coordinate (scaled)
 * @param scale Current zoom scale
 */
export const renderPin = (
  ctx: CanvasRenderingContext2D,
  pin: Pin,
  x: number,
  y: number,
  scale: number
): void => {
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
  
  // Draw a thinner arrow with true 45-degree angle pointing part and thinner, longer arrowhead
  ctx.fillStyle = pin.color;
  
  // Calculate arrow dimensions
  const arrowLength = pinSize * 3; // Length of the diagonal pointing part
  const arrowTailLength = pinSize * 5; // Length of the horizontal part
  const arrowHeadWidth = pinSize * 0.5; // Width of the arrowhead (thinner)
  
  // Calculate points for a true 45-degree angle
  // For a 45-degree angle, the x and y distances should be equal
  const diagonalOffset = arrowLength / Math.sqrt(2); // Equal x and y offset for 45 degrees
  
  // Calculate the bend point (where diagonal meets horizontal)
  const bendX = x - diagonalOffset;
  const bendY = y - diagonalOffset;
  
  // Draw the arrow shaft with stroke
  ctx.beginPath();
  ctx.lineWidth = arrowThickness;
  ctx.strokeStyle = pin.color;
  ctx.lineCap = 'round'; // Round the ends of the lines
  
  // Draw the horizontal tail
  ctx.moveTo(bendX - arrowTailLength, bendY);
  ctx.lineTo(bendX, bendY);
  
  // Draw the 45-degree pointing part (but stop short of the tip to add arrowhead)
  // Calculate a point further back from the tip for a longer arrowhead
  const arrowHeadBaseX = x - (diagonalOffset * 0.2);
  const arrowHeadBaseY = y - (diagonalOffset * 0.2);
  ctx.lineTo(arrowHeadBaseX, arrowHeadBaseY);
  
  ctx.stroke();
  
  // Draw the arrowhead as an outline (no fill)
  ctx.beginPath();
  ctx.lineWidth = arrowThickness;
  ctx.strokeStyle = pin.color;
  
  // Tip of the arrow
  ctx.moveTo(x, y);
  
  // Calculate perpendicular direction for arrowhead sides
  const dx = arrowHeadBaseX - x;
  const dy = arrowHeadBaseY - y;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  // Normalize and rotate for perpendicular direction
  const perpX = -dy / length;
  const perpY = dx / length;
  
  // Calculate arrowhead points for a thinner, longer shape
  const leftX = arrowHeadBaseX + perpX * arrowHeadWidth;
  const leftY = arrowHeadBaseY + perpY * arrowHeadWidth;
  const rightX = arrowHeadBaseX - perpX * arrowHeadWidth;
  const rightY = arrowHeadBaseY - perpY * arrowHeadWidth;
  
  // Draw arrowhead as lines (no fill)
  ctx.moveTo(x, y);
  ctx.lineTo(leftX, leftY);
  ctx.moveTo(x, y);
  ctx.lineTo(rightX, rightY);
  ctx.stroke();
  
  // Restore context (remove shadow)
  ctx.restore();
  
  // Draw text over the tail of the arrow
  if (pin.text.length > 0) {
    renderArrowText(ctx, pin, pinSize, arrowTailLength, bendX, bendY);
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
 */
export const renderArrowText = (
  ctx: CanvasRenderingContext2D,
  pin: Pin,
  pinSize: number,
  arrowTailLength: number,
  bendX: number,
  bendY: number
): void => {
  // Calculate text position (centered over the tail)
  const textX = bendX - arrowTailLength/2;
  const textY = bendY - pinSize * 0.8; // Position above the tail
  
  // Fixed font size that doesn't scale with zoom
  const fontSize = 11;
  const padding = 6;
  
  // Set font before measuring text
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  
  // Draw text background for better readability
  const textWidth = ctx.measureText(pin.text).width;
  const textBgWidth = Math.min(textWidth + padding * 2, arrowTailLength * 0.9);
  const textBgHeight = 16;
  
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.roundRect(
    textX - textBgWidth/2,
    textY - textBgHeight/2,
    textBgWidth,
    textBgHeight,
    4
  );
  ctx.fill();
  
  // Draw text
  ctx.fillStyle = '#333';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // If text is too long, truncate it
  let displayText = pin.text;
  if (textWidth > arrowTailLength * 0.8) {
    // Calculate how many characters we can fit
    const charsPerWidth = pin.text.length / textWidth;
    const maxChars = Math.floor(arrowTailLength * 0.8 * charsPerWidth);
    displayText = pin.text.substring(0, maxChars - 3) + '...';
  }
  
  ctx.fillText(displayText, textX, textY);
}; 