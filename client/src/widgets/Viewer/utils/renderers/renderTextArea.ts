import { TextArea } from '../../model/types/Drawings';
import { transformCoordinates } from '../rotationUtils';

/**
 * Renders a text area on the canvas
 */
export const renderTextArea = (
  ctx: CanvasRenderingContext2D,
  drawing: TextArea,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  // Transform text area coordinates with rotation
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

  // Calculate the width and height of the text area
  const areaWidth = Math.abs(areaEndX - areaStartX);
  const areaHeight = Math.abs(areaEndY - areaStartY);

  // Determine the actual top-left corner
  const drawX = Math.min(areaStartX, areaEndX);
  const drawY = Math.min(areaStartY, areaEndY);

  // Draw the rectangle border
  ctx.strokeStyle = drawing.style.strokeColor;
  const strokeWidth = drawing.style.strokeWidth * scale;
  ctx.lineWidth = strokeWidth;
  ctx.globalAlpha = drawing.style.opacity ?? 1;
  ctx.strokeRect(drawX, drawY, areaWidth, areaHeight);

  // Fill with a semi-transparent background
  ctx.fillStyle = `${drawing.style.strokeColor}15`; // 15 is the hex for ~10% opacity
  ctx.fillRect(drawX, drawY, areaWidth, areaHeight);

  // Scale font size based on scale factor and use fontSize from the drawing if available
  const baseFontSize = drawing.fontSize || 14;
  const scaledFontSize = baseFontSize * scale;
  ctx.font = `${scaledFontSize}px Arial`;
  ctx.fillStyle = drawing.style.strokeColor;

  // Padding for text (also scaled)
  // Account for stroke width: half extends inside the rectangle on each side, so we add strokeWidth/2
  const padding = 5 * scale;
  const textX = drawX + strokeWidth / 2 + padding;
  const lineHeight = scaledFontSize; // Line height matches font size

  // Calculate maximum width for text
  // Account for stroke width on both sides (strokeWidth/2 on each side) plus padding
  const maxTextWidth = areaWidth - strokeWidth - 2 * padding;

  // Handle text wrapping with proper line, word, and character breaks
  const wrapText = (text: string, maxWidth: number) => {
    const lines: string[] = [];
    const paragraphs = text.split('\n'); // Handle explicit line breaks

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push(''); // Preserve empty lines
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        // Check if the current line plus this word would fit
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const metrics = ctx.measureText(testLine);

        if (metrics.width <= maxWidth) {
          // The word fits on the current line
          currentLine = testLine;
        } else {
          // The word doesn't fit on the current line

          // If there's already text on the line, add it to lines and start a new line
          if (currentLine !== '') {
            lines.push(currentLine);
            currentLine = '';
          }

          // Now handle the current word - it might be too long by itself
          const wordMetrics = ctx.measureText(word);

          if (wordMetrics.width <= maxWidth) {
            // Word fits on its own line
            currentLine = word;
          } else {
            // Word is too long, need to break it into characters
            let charIndex = 0;
            while (charIndex < word.length) {
              let partialWord = '';
              let partialWidth = 0;

              // Keep adding characters until we reach max width
              while (charIndex < word.length && partialWidth <= maxWidth) {
                partialWord += word[charIndex];
                partialWidth = ctx.measureText(partialWord).width;

                if (partialWidth <= maxWidth) {
                  charIndex++;
                }
              }

              // If we couldn't fit even a single character, force at least one
              if (partialWord === '' && charIndex < word.length) {
                partialWord = word[charIndex];
                charIndex++;
              }

              // Add this part of the word to lines
              lines.push(partialWord);

              // Empty the current line as we're continuing with the long word
              currentLine = '';
            }
          }
        }
      }

      // Don't forget the last line
      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines;
  };

  // Wrap the text based on available width
  const textLines = wrapText(drawing.text, maxTextWidth);

  // Always start from the top-left corner with padding
  // Account for stroke width: half extends inside the rectangle at the top
  const startY = drawY + strokeWidth / 2 + padding + lineHeight * 0.8; // Adjust baseline for proper text positioning

  // Draw each line of text
  let yPos = startY;
  for (const line of textLines) {
    // Check if we've reached the bottom boundary
    // Account for stroke width: half extends inside the rectangle at the bottom
    if (yPos > drawY + areaHeight - strokeWidth / 2 - padding) {
      break;
    }

    // Ensure text doesn't exceed the rectangle width with additional check
    const lineWidth = ctx.measureText(line).width;
    if (lineWidth > maxTextWidth) {
      // Truncate text to fit if somehow it's still too wide
      let truncatedLine = line;
      while (truncatedLine.length > 0 && ctx.measureText(truncatedLine).width > maxTextWidth) {
        truncatedLine = truncatedLine.slice(0, -1);
      }
      ctx.fillText(truncatedLine, textX, yPos);
    } else {
      ctx.fillText(line, textX, yPos);
    }

    yPos += lineHeight;
  }
};
