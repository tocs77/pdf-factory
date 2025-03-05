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
  const pinSize = 12 * scale;
  
  // Save context for shadow
  ctx.save();
  
  // Add shadow for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 4 * scale;
  ctx.shadowOffsetX = 2 * scale;
  ctx.shadowOffsetY = 2 * scale;
  
  // Draw standard map pin shape
  ctx.fillStyle = pin.color;
  
  // Start drawing the pin (teardrop/balloon shape)
  ctx.beginPath();
  
  // Draw the circular top
  ctx.arc(x, y - pinSize, pinSize, 0, Math.PI * 2);
  ctx.fill();
  
  // Draw the pointed bottom part
  ctx.beginPath();
  ctx.moveTo(x - pinSize, y - pinSize);
  ctx.lineTo(x, y + pinSize * 1.2); // Point at the bottom
  ctx.lineTo(x + pinSize, y - pinSize);
  ctx.closePath();
  ctx.fill();
  
  // Draw inner circle (white dot)
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.arc(x, y - pinSize, pinSize * 0.5, 0, Math.PI * 2);
  ctx.fill();
  
  // Restore context (remove shadow)
  ctx.restore();
  
  // Draw text bubble if there's text
  if (pin.text.length > 0) {
    renderPinBubble(ctx, pin, x, y, pinSize, scale);
  }
};

/**
 * Renders a text bubble for a pin
 * @param ctx Canvas rendering context
 * @param pin Pin data
 * @param x X coordinate (scaled)
 * @param y Y coordinate (scaled)
 * @param pinSize Size of the pin
 * @param scale Current zoom scale
 */
export const renderPinBubble = (
  ctx: CanvasRenderingContext2D,
  pin: Pin,
  x: number,
  y: number,
  pinSize: number,
  scale: number
): void => {
  // Save context for bubble shadow
  ctx.save();
  
  // Add shadow for bubble
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 6 * scale;
  ctx.shadowOffsetX = 1 * scale;
  ctx.shadowOffsetY = 1 * scale;
  
  const bubbleWidth = Math.max(120 * scale, pin.text.length * 8 * scale);
  const bubbleHeight = 36 * scale;
  const bubbleRadius = 8 * scale;
  
  // Draw bubble with rounded corners
  ctx.fillStyle = 'white';
  ctx.beginPath();
  
  // Use roundRect if available, otherwise draw manually
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(
      x - bubbleWidth / 2,
      y - pinSize * 3.5 - bubbleHeight,
      bubbleWidth,
      bubbleHeight,
      bubbleRadius
    );
  } else {
    // Manual rounded rectangle
    const bubbleX = x - bubbleWidth / 2;
    const bubbleY = y - pinSize * 3.5 - bubbleHeight;
    
    ctx.moveTo(bubbleX + bubbleRadius, bubbleY);
    ctx.lineTo(bubbleX + bubbleWidth - bubbleRadius, bubbleY);
    ctx.arcTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + bubbleRadius, bubbleRadius);
    ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - bubbleRadius);
    ctx.arcTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - bubbleRadius, bubbleY + bubbleHeight, bubbleRadius);
    ctx.lineTo(bubbleX + bubbleRadius, bubbleY + bubbleHeight);
    ctx.arcTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - bubbleRadius, bubbleRadius);
    ctx.lineTo(bubbleX, bubbleY + bubbleRadius);
    ctx.arcTo(bubbleX, bubbleY, bubbleX + bubbleRadius, bubbleY, bubbleRadius);
  }
  ctx.fill();
  
  // Draw bubble border with pin color
  ctx.strokeStyle = pin.color;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
  
  // Restore context (remove shadow)
  ctx.restore();
  
  // Draw text in bubble
  ctx.fillStyle = '#333';
  ctx.font = `bold ${12 * scale}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    pin.text,
    x,
    y - pinSize * 3.5 - bubbleHeight / 2
  );
  
  // Draw pointer from bubble to pin
  ctx.beginPath();
  ctx.fillStyle = 'white';
  
  // Create triangle pointer that aligns with the pin
  const pointerTipY = y - pinSize * 2;
  ctx.moveTo(x, pointerTipY);
  ctx.lineTo(x - 8 * scale, y - pinSize * 3.5);
  ctx.lineTo(x + 8 * scale, y - pinSize * 3.5);
  ctx.closePath();
  ctx.fill();
  
  // Draw pointer border
  ctx.strokeStyle = pin.color;
  ctx.lineWidth = 2 * scale;
  ctx.stroke();
}; 