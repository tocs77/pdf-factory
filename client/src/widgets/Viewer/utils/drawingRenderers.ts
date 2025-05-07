import {
  DrawingPath,
  Rectangle,
  Line,
  DrawArea,
  TextUnderline,
  TextCrossedOut,
  TextHighlight,
  TextArea,
  PinSelection,
  RectSelection,
} from '../model/types/Drawings';
import { transformCoordinates } from './rotationUtils';

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

/**
 * Renders a line drawing on the canvas
 */
export const renderLine = (
  ctx: CanvasRenderingContext2D,
  drawing: Line,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  // Draw each line in the lines array
  drawing.lines.forEach((line, lineIndex) => {
    // Get line-specific style if available, otherwise use the default style
    const lineStyle = drawing.lineStyles?.[lineIndex] || drawing.style;
    ctx.strokeStyle = lineStyle.strokeColor;
    ctx.lineWidth = lineStyle.strokeWidth * scale;
    ctx.lineCap = 'round';

    ctx.beginPath();

    // Transform line points with rotation
    const { x: lineStartX, y: lineStartY } = transformCoordinates(
      line.startPoint.x,
      line.startPoint.y,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    const { x: lineEndX, y: lineEndY } = transformCoordinates(
      line.endPoint.x,
      line.endPoint.y,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    ctx.moveTo(lineStartX, lineStartY);
    ctx.lineTo(lineEndX, lineEndY);
    ctx.stroke();
  });
};

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
    const r = parseInt(strokeColor.slice(1, 3), 16);
    const g = parseInt(strokeColor.slice(3, 5), 16);
    const b = parseInt(strokeColor.slice(5, 7), 16);
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
  ctx.strokeRect(areaStartX, areaStartY, areaWidth, areaHeight);
};

/**
 * Renders a text underline on the canvas
 */
export const renderTextUnderline = (
  ctx: CanvasRenderingContext2D,
  drawing: TextUnderline,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  ctx.beginPath();
  ctx.strokeStyle = drawing.style.strokeColor;
  ctx.lineWidth = drawing.style.strokeWidth * scale;
  ctx.setLineDash([]); // Solid line

  // Draw each line segment
  drawing.lines.forEach((line) => {
    // Transform start and end points with rotation
    const { x: startX, y: startY } = transformCoordinates(line.start.x, line.start.y, canvasWidth, canvasHeight, scale, rotation);

    const { x: endX, y: endY } = transformCoordinates(line.end.x, line.end.y, canvasWidth, canvasHeight, scale, rotation);

    // Draw a line from start to end for the underline
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  });
};

/**
 * Renders a text crossed-out on the canvas
 */
export const renderTextCrossedOut = (
  ctx: CanvasRenderingContext2D,
  drawing: TextCrossedOut,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  ctx.beginPath();
  ctx.strokeStyle = drawing.style.strokeColor;
  ctx.lineWidth = drawing.style.strokeWidth * scale;
  ctx.setLineDash([]); // Solid line

  // Draw each line segment
  drawing.lines.forEach((line) => {
    // Transform start and end points with rotation
    const { x: startX, y: startY } = transformCoordinates(line.start.x, line.start.y, canvasWidth, canvasHeight, scale, rotation);

    const { x: endX, y: endY } = transformCoordinates(line.end.x, line.end.y, canvasWidth, canvasHeight, scale, rotation);

    // Draw a line from start to end for the crossed out text
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  });
};

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
  ctx.lineWidth = drawing.style.strokeWidth * scale;
  ctx.strokeRect(drawX, drawY, areaWidth, areaHeight);

  // Fill with a semi-transparent background
  ctx.fillStyle = `${drawing.style.strokeColor}15`; // 15 is the hex for ~10% opacity
  ctx.fillRect(drawX, drawY, areaWidth, areaHeight);

  // Scale font size based on scale factor
  const baseFontSize = 14;
  const scaledFontSize = baseFontSize * scale;
  ctx.font = `${scaledFontSize}px Arial`;
  ctx.fillStyle = drawing.style.strokeColor;

  // Padding for text (also scaled)
  const padding = 5 * scale;
  const textX = drawX + padding;
  const lineHeight = scaledFontSize;

  // Calculate maximum width for text
  const maxTextWidth = areaWidth - 2 * padding;

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
  const startY = drawY + padding + lineHeight * 0.8; // Adjust baseline for proper text positioning

  // Draw each line of text
  let yPos = startY;
  for (const line of textLines) {
    // Check if we've reached the bottom boundary
    if (yPos > drawY + areaHeight - padding) {
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

/**
 * Renders a map-style pin icon on the canvas for pinSelection
 */
export const renderpinSelection = (
  ctx: CanvasRenderingContext2D,
  drawing: PinSelection,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): void => {
  const pinSize = 20 * scale; // Size of the pin head
  const stemHeight = 10 * scale; // Height of the stem below the circle
  const pinColor = drawing.color || '#FF0000'; // Use drawing color or fallback to Red

  // Transform the pin's normalized position to canvas coordinates
  const { x, y } = transformCoordinates(drawing.position.x, drawing.position.y, canvasWidth, canvasHeight, scale, rotation);

  // Draw the pin shape (circle + stem/triangle)
  ctx.beginPath();
  ctx.fillStyle = pinColor;
  ctx.strokeStyle = '#000000'; // Black outline
  ctx.lineWidth = 1 * scale;

  // Draw the main circle part of the pin (head)
  // The position (x, y) is the tip, so center the circle above it
  ctx.arc(x, y - stemHeight - pinSize / 2, pinSize / 2, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();

  // Draw the stem/triangle part pointing to the location
  ctx.beginPath();
  ctx.moveTo(x, y); // Tip
  ctx.lineTo(x - pinSize / 4, y - stemHeight); // Bottom-left of head connection
  ctx.lineTo(x + pinSize / 4, y - stemHeight); // Bottom-right of head connection
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};
