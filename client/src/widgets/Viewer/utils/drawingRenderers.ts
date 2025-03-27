import {
  DrawingPath,
  Rectangle,
  Line,
  DrawArea,
  TextUnderline,
  TextCrossedOut,
  TextHighlight,
  TextArea,
} from '../model/types/viewerSchema';
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
  drawing: DrawArea,
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

  // Draw the text inside the rectangle
  ctx.fillStyle = drawing.style.strokeColor;
  ctx.font = '14px Arial';

  // Padding for text
  const padding = 10 * scale;
  const textX = drawX + padding;
  const textY = drawY + 20 * scale; // Start from the top with some padding

  // Text wrapping logic - crude implementation
  const words = drawing.text.split(' ');
  let line = '';
  let lineHeight = 16 * scale;
  let yPos = textY;

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + ' ';
    const metrics = ctx.measureText(testLine);
    const testWidth = metrics.width;

    if (testWidth > areaWidth - 2 * padding && i > 0) {
      // If the line is too long, draw the current line and start a new one
      ctx.fillText(line, textX, yPos);
      line = words[i] + ' ';
      yPos += lineHeight;

      // Break if we've reached the bottom of the area
      if (yPos > drawY + areaHeight - padding) {
        break;
      }
    } else {
      // If the line fits, add the word
      line = testLine;
    }
  }

  // Draw the last line
  if (line.trim() !== '' && yPos <= drawY + areaHeight - padding) {
    ctx.fillText(line, textX, yPos);
  }
};
