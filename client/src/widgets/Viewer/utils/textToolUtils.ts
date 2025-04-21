import { TextHighlight, TextUnderline, TextCrossedOut } from '../model/types/viewerSchema';
import { renderTextHighlight, renderTextUnderline, renderTextCrossedOut } from './drawingRenderers';
import { RefObject } from 'react';
export { renderTextLayer } from './renderTextLayer';

/**
 * Function to determine if a color is light (for text contrast)
 */
export const isLightColor = (color: string): boolean => {
  // Convert hex to RGB
  let r, g, b;
  if (color.startsWith('#')) {
    r = parseInt(color.slice(1, 3), 16);
    g = parseInt(color.slice(3, 5), 16);
    b = parseInt(color.slice(5, 7), 16);
  } else {
    // Default to dark if not a hex color
    return false;
  }

  // Calculate luminance (perceived brightness)
  // Using the formula: 0.299*R + 0.587*G + 0.114*B
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Return true if the color is light (luminance > 0.5)
  return luminance > 0.5;
};

/**
 * Get selected text elements from the current page
 */
export const getSelectedElements = (selection: Selection | null, container: HTMLElement): HTMLElement[] => {
  const elements: HTMLElement[] = [];

  if (!selection || !container) return elements;

  // Look specifically for span elements that are likely to contain text
  // Limiting query to within the provided container
  container.querySelectorAll('span').forEach((node) => {
    // Check if this node is part of the selection
    if (selection.containsNode(node, true)) {
      // Only include nodes with actual text content
      if (node.textContent && node.textContent.trim() !== '') {
        elements.push(node as HTMLElement);
      }
    }
  });

  // Sort elements by their vertical position for proper line ordering
  elements.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();

    // If the difference in y-coordinate is significant, sort by y
    if (Math.abs(rectA.top - rectB.top) > 5) {
      return rectA.top - rectB.top;
    }
    // Within the same line, sort by x
    return rectA.left - rectB.left;
  });

  return elements;
};

/**
 * Function to calculate line segments for multiple lines of text
 */
export const getLineSegments = (
  selection: Selection | null,
  pageNumber: number,
  scale: number,
  container?: HTMLElement,
): { start: { x: number; y: number }; end: { x: number; y: number } }[] => {
  if (!selection || selection.rangeCount === 0) return [];

  const lines: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];

  // Find the page container if not provided
  const pageContainer = container || document.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!pageContainer) return lines;

  // Get all spans that are part of the selection
  const selectedElements = getSelectedElements(selection, pageContainer as HTMLElement);

  // If no elements found, try using range.getClientRects as fallback
  if (selectedElements.length === 0) {
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      const clientRects = range.getClientRects();

      for (let j = 0; j < clientRects.length; j++) {
        const rect = clientRects[j];
        // Skip very thin rects
        if (rect.height < 5) continue;

        const pageRect = pageContainer.getBoundingClientRect();

        // Calculate coordinates relative to the page
        const startX = (rect.left - pageRect.left) / scale;
        const endX = (rect.right - pageRect.left) / scale;
        const y = (rect.bottom - pageRect.top - 2) / scale;

        lines.push({
          start: { x: startX, y },
          end: { x: endX, y },
        });
      }
    }
  } else {
    // Group elements by line (based on y-coordinate)
    const lineGroups: HTMLElement[][] = [];
    let currentLine: HTMLElement[] = [];
    let lastY = -1;

    selectedElements.forEach((element) => {
      const rect = element.getBoundingClientRect();

      // If this element is on a new line (y-coord differs significantly)
      if (lastY >= 0 && Math.abs(rect.top - lastY) > 5) {
        if (currentLine.length > 0) {
          lineGroups.push(currentLine);
          currentLine = [];
        }
      }

      currentLine.push(element);
      lastY = rect.top;
    });

    // Add the last line if not empty
    if (currentLine.length > 0) {
      lineGroups.push(currentLine);
    }

    const pageRect = pageContainer.getBoundingClientRect();

    // Process each line group to create a single underline per line
    lineGroups.forEach((lineElements) => {
      if (lineElements.length === 0) return;

      // Sort elements in the line by x-coordinate
      lineElements.sort((a, b) => {
        return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
      });

      // Get leftmost and rightmost elements
      const firstElement = lineElements[0];
      const lastElement = lineElements[lineElements.length - 1];

      const firstRect = firstElement.getBoundingClientRect();
      const lastRect = lastElement.getBoundingClientRect();

      // Create a single line segment for the entire line
      const startX = (firstRect.left - pageRect.left) / scale;
      const endX = (lastRect.right - pageRect.left) / scale;
      const y = (firstRect.bottom - pageRect.top - 2) / scale; // Position slightly below text

      lines.push({
        start: { x: startX, y },
        end: { x: endX, y },
      });
    });
  }

  return lines;
};

/**
 * Function to calculate rectangle segments for text highlighting
 */
export const getHighlightRects = (
  selection: Selection | null,
  pageNumber: number,
  scale: number,
  container?: HTMLElement,
): { x: number; y: number; width: number; height: number }[] => {
  if (!selection || selection.rangeCount === 0) return [];

  const rects: { x: number; y: number; width: number; height: number }[] = [];

  // Find the page container if not provided
  const pageContainer = container || document.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!pageContainer) return rects;

  console.log('pageContainer', pageContainer.getBoundingClientRect());

  // Get all spans that are part of the selection
  const selectedElements = getSelectedElements(selection, pageContainer as HTMLElement);

  // If no elements found, try using range.getClientRects as fallback
  if (selectedElements.length === 0) {
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      const clientRects = range.getClientRects();

      for (let j = 0; j < clientRects.length; j++) {
        const rect = clientRects[j];
        // Skip very thin rects
        if (rect.height < 5) continue;

        const pageRect = pageContainer.getBoundingClientRect();

        // Calculate coordinates relative to the page
        const x = (rect.left - pageRect.left) / scale;
        const y = (rect.top - pageRect.top) / scale;
        const width = rect.width / scale;
        const height = rect.height / scale;

        rects.push({ x, y, width, height });
      }
    }
  } else {
    // Group elements by line (based on y-coordinate)
    const lineGroups: HTMLElement[][] = [];
    let currentLine: HTMLElement[] = [];
    let lastY = -1;

    selectedElements.forEach((element) => {
      const rect = element.getBoundingClientRect();

      // If this element is on a new line (y-coord differs significantly)
      if (lastY >= 0 && Math.abs(rect.top - lastY) > 5) {
        if (currentLine.length > 0) {
          lineGroups.push(currentLine);
          currentLine = [];
        }
      }

      currentLine.push(element);
      lastY = rect.top;
    });

    // Add the last line if not empty
    if (currentLine.length > 0) {
      lineGroups.push(currentLine);
    }

    const pageRect = pageContainer.getBoundingClientRect();

    // Process each line group to create a single highlight rectangle per line
    lineGroups.forEach((lineElements) => {
      if (lineElements.length === 0) return;

      // Sort elements in the line by x-coordinate
      lineElements.sort((a, b) => {
        return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
      });

      // Get leftmost and rightmost elements
      const firstElement = lineElements[0];
      const lastElement = lineElements[lineElements.length - 1];

      const firstRect = firstElement.getBoundingClientRect();
      const lastRect = lastElement.getBoundingClientRect();

      // Find the top-most and bottom-most points in this line
      let minY = Infinity;
      let maxY = -Infinity;

      lineElements.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        minY = Math.min(minY, elRect.top);
        maxY = Math.max(maxY, elRect.bottom);
      });

      // Create a single rectangle for the entire line
      const x = (firstRect.left - pageRect.left) / scale;
      const y = (minY - pageRect.top) / scale;
      const width = (lastRect.right - firstRect.left) / scale;
      const height = (maxY - minY) / scale;

      rects.push({ x, y, width, height });
    });
  }

  return rects;
};

/**
 * Function to capture the text annotation image
 */
export const captureTextAnnotationImage = (
  annotationType: 'highlight' | 'underline' | 'crossedout',
  annotationData: TextHighlight | TextUnderline | TextCrossedOut,
  pageNumber: number,
  scale: number,
  pdfCanvasRef: RefObject<HTMLCanvasElement>,
  textRects?: { x: number; y: number; width: number; height: number }[],
): string | null => {
  if (!pdfCanvasRef?.current) return null;

  // Create a temporary canvas for rendering
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) return null;

  // Find the page container
  const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!pageContainer) return null;

  // Calculate the bounding box for all elements
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  if (annotationType === 'highlight') {
    const highlightData = annotationData as TextHighlight;
    highlightData.rects.forEach((rect) => {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    });
  } else if (textRects && textRects.length > 0) {
    // For underline and crossedout, use the text rectangles to get the complete text region
    // INCLUDING the full height of text (not just the bottom line where underlines go)
    textRects.forEach((rect) => {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    });

    // Also consider the line positions to ensure they're included
    const lineData = annotationData as TextUnderline | TextCrossedOut;
    lineData.lines.forEach((line) => {
      minX = Math.min(minX, line.start.x, line.end.x);
      maxX = Math.max(maxX, line.start.x, line.end.x);
      maxY = Math.max(maxY, line.start.y, line.end.y);
    });
  } else {
    // Fallback to using just the lines (less accurate for text height)
    const lineData = annotationData as TextUnderline | TextCrossedOut;
    lineData.lines.forEach((line) => {
      minX = Math.min(minX, line.start.x, line.end.x);
      minY = Math.min(minY, line.start.y, line.end.y);
      maxX = Math.max(maxX, line.start.x, line.end.x);
      maxY = Math.max(maxY, line.start.y, line.end.y);
    });

    // Add a larger upward extension as fallback
    const textHeight = 20 / scale;
    minY = Math.max(0, minY - textHeight);
  }

  // Add padding (different for different annotation types)
  const padding = annotationType === 'highlight' ? 5 : 8;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = maxX + padding;
  maxY = maxY + padding;

  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) return null;

  // Set canvas dimensions at scale 1
  const canvasWidth = width;
  const canvasHeight = height;
  tempCanvas.width = canvasWidth * window.devicePixelRatio;
  tempCanvas.height = canvasHeight * window.devicePixelRatio;

  // Scale the canvas context
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Crop and draw the PDF content
  const pdfCanvas = pdfCanvasRef.current;
  ctx.drawImage(
    pdfCanvas,
    minX * scale * window.devicePixelRatio,
    minY * scale * window.devicePixelRatio,
    width * scale * window.devicePixelRatio,
    height * scale * window.devicePixelRatio,
    0,
    0,
    canvasWidth,
    canvasHeight,
  );

  // Adjust annotation coordinates to be relative to the crop area
  let adjustedAnnotation: TextHighlight | TextUnderline | TextCrossedOut;
  switch (annotationType) {
    case 'highlight': {
      adjustedAnnotation = { ...(annotationData as TextHighlight) };
      (adjustedAnnotation as TextHighlight).rects = (adjustedAnnotation as TextHighlight).rects.map((rect) => ({
        x: rect.x - minX,
        y: rect.y - minY,
        width: rect.width,
        height: rect.height,
      }));

      renderTextHighlight(ctx, adjustedAnnotation as TextHighlight, canvasWidth, canvasHeight, 1, 0);
      break;
    }
    case 'underline': {
      adjustedAnnotation = { ...(annotationData as TextUnderline) };
      (adjustedAnnotation as TextUnderline).lines = (adjustedAnnotation as TextUnderline).lines.map((line) => ({
        start: { x: line.start.x - minX, y: line.start.y - minY },
        end: { x: line.end.x - minX, y: line.end.y - minY },
      }));

      renderTextUnderline(ctx, adjustedAnnotation as TextUnderline, canvasWidth, canvasHeight, 1, 0);
      break;
    }
    case 'crossedout': {
      adjustedAnnotation = { ...(annotationData as TextCrossedOut) };
      (adjustedAnnotation as TextCrossedOut).lines = (adjustedAnnotation as TextCrossedOut).lines.map((line) => ({
        start: { x: line.start.x - minX, y: line.start.y - minY },
        end: { x: line.end.x - minX, y: line.end.y - minY },
      }));

      renderTextCrossedOut(ctx, adjustedAnnotation as TextCrossedOut, canvasWidth, canvasHeight, 1, 0);
      break;
    }
  }

  // Return the image data
  return tempCanvas.toDataURL('image/png');
};
