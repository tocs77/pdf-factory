import { TextHighlight, TextCrossedOut, TextUnderline } from '../model/types/Drawings';
import { renderTextHighlight, renderTextUnderline, renderTextCrossedOut } from './renderers';
import { normalizeCoordinatesToZeroRotation, transformCoordinates } from './rotationUtils';
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
 * Processes a selection range to create line segments based on the range client rects
 */
export const processRangeClientRects = (
  range: Range,
  pageRect: DOMRect,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  rotation: number,
  isVerticalText: boolean,
): { start: { x: number; y: number }; end: { x: number; y: number } }[] => {
  const lines: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];
  const clientRects = range.getClientRects();

  for (let j = 0; j < clientRects.length; j++) {
    const rect = clientRects[j];
    // Skip very thin rects
    if (rect.height < 5) continue;

    // Calculate coordinates relative to the page
    if (isVerticalText) {
      // For vertical text (90° or 270° rotation), create vertical lines
      const x = (rect.left - pageRect.left + rect.width / 2) / scale; // Middle of the text horizontally
      const startY = (rect.top - pageRect.top) / scale;
      const endY = (rect.bottom - pageRect.top) / scale;

      // Normalize coordinates based on rotation
      if (rotation > 0) {
        // Fix for linter - check if rotation is non-zero
        const startPoint = normalizeCoordinatesToZeroRotation(
          { x, y: startY },
          pageWidth / scale,
          pageHeight / scale,
          1,
          rotation,
        );

        const endPoint = normalizeCoordinatesToZeroRotation({ x, y: endY }, pageWidth / scale, pageHeight / scale, 1, rotation);

        lines.push({
          start: startPoint,
          end: endPoint,
        });
      } else {
        lines.push({
          start: { x, y: startY },
          end: { x, y: endY },
        });
      }
    } else {
      // For horizontal text (0° or 180° rotation), create horizontal lines
      const startX = (rect.left - pageRect.left) / scale;
      const endX = (rect.right - pageRect.left) / scale;
      const y = (rect.bottom - pageRect.top - 2) / scale;

      // Normalize coordinates based on rotation
      if (rotation > 0) {
        // Fix for linter - check if rotation is non-zero
        const startPoint = normalizeCoordinatesToZeroRotation(
          { x: startX, y },
          pageWidth / scale,
          pageHeight / scale,
          1,
          rotation,
        );

        const endPoint = normalizeCoordinatesToZeroRotation({ x: endX, y }, pageWidth / scale, pageHeight / scale, 1, rotation);

        lines.push({
          start: startPoint,
          end: endPoint,
        });
      } else {
        lines.push({
          start: { x: startX, y },
          end: { x: endX, y },
        });
      }
    }
  }

  return lines;
};

/**
 * Groups text elements into lines or columns based on their position
 */
export const groupElementsByPosition = (selectedElements: HTMLElement[], isVerticalText: boolean): HTMLElement[][] => {
  const groups: HTMLElement[][] = [];
  let currentGroup: HTMLElement[] = [];
  let lastPosition = -1;

  selectedElements.forEach((element) => {
    const rect = element.getBoundingClientRect();

    // Different grouping based on rotation
    let currentPosition;
    if (isVerticalText) {
      // For vertical text, group by x-coordinate
      currentPosition = rect.left;
    } else {
      // For horizontal text, group by y-coordinate
      currentPosition = rect.top;
    }

    // If this element is on a new line/column
    if (lastPosition >= 0 && Math.abs(currentPosition - lastPosition) > 5) {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
    }

    currentGroup.push(element);
    lastPosition = currentPosition;
  });

  // Add the last group if not empty
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  return groups;
};

/**
 * Creates a vertical line segment for a group of elements
 */
export const createVerticalLineSegment = (
  lineElements: HTMLElement[],
  pageRect: DOMRect,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  rotation: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } | null => {
  if (lineElements.length === 0) return null;

  // For vertical text (90° or 270° rotation), sort by y-coordinate
  lineElements.sort((a, b) => {
    return a.getBoundingClientRect().top - b.getBoundingClientRect().top;
  });

  // Get topmost and bottommost elements
  const firstElement = lineElements[0];
  const lastElement = lineElements[lineElements.length - 1];

  const firstRect = firstElement.getBoundingClientRect();
  const lastRect = lastElement.getBoundingClientRect();

  // Create a vertical line segment for the entire column
  const x = (firstRect.left - pageRect.left + firstRect.width / 2) / scale; // Middle of the text horizontally
  const startY = (firstRect.top - pageRect.top) / scale;
  const endY = (lastRect.bottom - pageRect.top) / scale;

  // Normalize coordinates based on rotation
  if (rotation > 0) {
    // Fix for linter - check if rotation is non-zero
    const startPoint = normalizeCoordinatesToZeroRotation({ x, y: startY }, pageWidth / scale, pageHeight / scale, 1, rotation);

    const endPoint = normalizeCoordinatesToZeroRotation({ x, y: endY }, pageWidth / scale, pageHeight / scale, 1, rotation);

    return {
      start: startPoint,
      end: endPoint,
    };
  } else {
    return {
      start: { x, y: startY },
      end: { x, y: endY },
    };
  }
};

/**
 * Creates a horizontal line segment for a group of elements
 */
export const createHorizontalLineSegment = (
  lineElements: HTMLElement[],
  pageRect: DOMRect,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  rotation: number,
): { start: { x: number; y: number }; end: { x: number; y: number } } | null => {
  if (lineElements.length === 0) return null;

  // For horizontal text (0° or 180° rotation), sort by x-coordinate
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

  // Normalize coordinates based on rotation
  if (rotation > 0) {
    const startPoint = normalizeCoordinatesToZeroRotation({ x: startX, y }, pageWidth / scale, pageHeight / scale, 1, rotation);

    const endPoint = normalizeCoordinatesToZeroRotation({ x: endX, y }, pageWidth / scale, pageHeight / scale, 1, rotation);

    return {
      start: startPoint,
      end: endPoint,
    };
  } else {
    return {
      start: { x: startX, y },
      end: { x: endX, y },
    };
  }
};

/**
 * Creates line segments from element groups
 */
export const createLineSegmentsFromGroups = (
  lineGroups: HTMLElement[][],
  pageRect: DOMRect,
  pageWidth: number,
  pageHeight: number,
  scale: number,
  rotation: number,
  isVerticalText: boolean,
): { start: { x: number; y: number }; end: { x: number; y: number } }[] => {
  const lines: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];

  lineGroups.forEach((lineElements) => {
    if (lineElements.length === 0) return;

    const lineSegment = isVerticalText
      ? createVerticalLineSegment(lineElements, pageRect, pageWidth, pageHeight, scale, rotation)
      : createHorizontalLineSegment(lineElements, pageRect, pageWidth, pageHeight, scale, rotation);

    if (lineSegment) {
      lines.push(lineSegment);
    }
  });

  return lines;
};

/**
 * Function to calculate line segments for multiple lines of text
 */
export const getLineSegments = (
  selection: Selection | null,
  pageNumber: number,
  scale: number,
  container?: HTMLElement,
  rotation: number = 0,
): { start: { x: number; y: number }; end: { x: number; y: number } }[] => {
  if (!selection || selection.rangeCount === 0) return [];

  const lines: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];

  // Find the page container if not provided
  const pageContainer = container || document.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!pageContainer) return lines;

  // Get all spans that are part of the selection
  const selectedElements = getSelectedElements(selection, pageContainer as HTMLElement);

  const pageRect = pageContainer.getBoundingClientRect();
  const pageWidth = pageRect.width;
  const pageHeight = pageRect.height;

  // Check if we need to create vertical lines (for 90 and 270 degree rotations)
  const isVerticalText = rotation === 90 || rotation === 270;

  // If no elements found, try using range.getClientRects as fallback
  if (selectedElements.length === 0) {
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      const rangeLines = processRangeClientRects(range, pageRect, pageWidth, pageHeight, scale, rotation, isVerticalText);
      lines.push(...rangeLines);
    }
  } else {
    // Group elements by line or column
    const lineGroups = groupElementsByPosition(selectedElements, isVerticalText);

    // Create line segments from the groups
    const groupLines = createLineSegmentsFromGroups(lineGroups, pageRect, pageWidth, pageHeight, scale, rotation, isVerticalText);

    lines.push(...groupLines);
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
  rotation: number = 0,
): { x: number; y: number; width: number; height: number }[] => {
  if (!selection || selection.rangeCount === 0) return [];

  const rects: { x: number; y: number; width: number; height: number }[] = [];

  // Find the page container if not provided
  const pageContainer = container || document.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!pageContainer) return rects;

  // Get all spans that are part of the selection
  const selectedElements = getSelectedElements(selection, pageContainer as HTMLElement);

  const pageRect = pageContainer.getBoundingClientRect();
  const pageWidth = pageRect.width;
  const pageHeight = pageRect.height;

  // If no elements found, try using range.getClientRects as fallback
  if (selectedElements.length === 0) {
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      const clientRects = range.getClientRects();

      for (let j = 0; j < clientRects.length; j++) {
        const rect = clientRects[j];
        // Skip very thin rects
        if (rect.height < 5) continue;

        // Calculate coordinates relative to the page
        const x = (rect.left - pageRect.left) / scale;
        const y = (rect.top - pageRect.top) / scale;
        const width = rect.width / scale;
        const height = rect.height / scale;

        // Normalize coordinates based on rotation
        if (rotation !== 0) {
          const topLeft = normalizeCoordinatesToZeroRotation({ x, y }, pageWidth / scale, pageHeight / scale, 1, rotation);

          const bottomRight = normalizeCoordinatesToZeroRotation(
            { x: x + width, y: y + height },
            pageWidth / scale,
            pageHeight / scale,
            1,
            rotation,
          );

          // Ensure correct rectangle dimensions regardless of rotation
          const normalizedX = Math.min(topLeft.x, bottomRight.x);
          const normalizedY = Math.min(topLeft.y, bottomRight.y);
          const normalizedWidth = Math.abs(bottomRight.x - topLeft.x);
          const normalizedHeight = Math.abs(bottomRight.y - topLeft.y);

          rects.push({
            x: normalizedX,
            y: normalizedY,
            width: normalizedWidth,
            height: normalizedHeight,
          });
        } else {
          rects.push({ x, y, width, height });
        }
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

      // Normalize coordinates based on rotation
      if (rotation !== 0) {
        const topLeft = normalizeCoordinatesToZeroRotation({ x, y }, pageWidth / scale, pageHeight / scale, 1, rotation);

        const bottomRight = normalizeCoordinatesToZeroRotation(
          { x: x + width, y: y + height },
          pageWidth / scale,
          pageHeight / scale,
          1,
          rotation,
        );

        // Ensure correct rectangle dimensions regardless of rotation
        const normalizedX = Math.min(topLeft.x, bottomRight.x);
        const normalizedY = Math.min(topLeft.y, bottomRight.y);
        const normalizedWidth = Math.abs(bottomRight.x - topLeft.x);
        const normalizedHeight = Math.abs(bottomRight.y - topLeft.y);

        rects.push({
          x: normalizedX,
          y: normalizedY,
          width: normalizedWidth,
          height: normalizedHeight,
        });
      } else {
        rects.push({ x, y, width, height });
      }
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
  rotation: number = 0,
): string | null => {
  if (!pdfCanvasRef?.current) return null;

  // Create a temporary canvas for rendering
  const tempCanvas = document.createElement('canvas');
  const ctx = tempCanvas.getContext('2d');
  if (!ctx) return null;

  // Find the page container
  const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
  if (!pageContainer) return null;

  const pageRect = pageContainer.getBoundingClientRect();
  const canvasWidth = pageRect.width / scale;
  const canvasHeight = pageRect.height / scale;

  // Calculate the bounding box for all elements in original rotated coordinates
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Get bounds in the coordinate system that matches the current rotation
  if (annotationType === 'highlight') {
    const highlightData = annotationData as TextHighlight;
    highlightData.rects.forEach((rect) => {
      // For each rectangle, transform corners to account for rotation
      const corners = [
        transformCoordinates(rect.x, rect.y, canvasWidth, canvasHeight, 1, rotation),
        transformCoordinates(rect.x + rect.width, rect.y, canvasWidth, canvasHeight, 1, rotation),
        transformCoordinates(rect.x, rect.y + rect.height, canvasWidth, canvasHeight, 1, rotation),
        transformCoordinates(rect.x + rect.width, rect.y + rect.height, canvasWidth, canvasHeight, 1, rotation),
      ];

      // Find bounds of transformed rectangle
      corners.forEach((corner) => {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      });
    });
  } else if (textRects && textRects.length > 0) {
    // For underline and crossedout, use the text rectangles to get the complete text region
    textRects.forEach((rect) => {
      // For each rectangle, transform corners to account for rotation
      const corners = [
        transformCoordinates(rect.x, rect.y, canvasWidth, canvasHeight, 1, rotation),
        transformCoordinates(rect.x + rect.width, rect.y, canvasWidth, canvasHeight, 1, rotation),
        transformCoordinates(rect.x, rect.y + rect.height, canvasWidth, canvasHeight, 1, rotation),
        transformCoordinates(rect.x + rect.width, rect.y + rect.height, canvasWidth, canvasHeight, 1, rotation),
      ];

      // Find bounds of transformed rectangle
      corners.forEach((corner) => {
        minX = Math.min(minX, corner.x);
        minY = Math.min(minY, corner.y);
        maxX = Math.max(maxX, corner.x);
        maxY = Math.max(maxY, corner.y);
      });
    });

    // Also consider the line positions to ensure they're included
    const lineData = annotationData as TextUnderline | TextCrossedOut;
    lineData.lines.forEach((line) => {
      // Transform start and end points
      const startPoint = transformCoordinates(line.start.x, line.start.y, canvasWidth, canvasHeight, 1, rotation);
      const endPoint = transformCoordinates(line.end.x, line.end.y, canvasWidth, canvasHeight, 1, rotation);

      minX = Math.min(minX, startPoint.x, endPoint.x);
      minY = Math.min(minY, startPoint.y, endPoint.y);
      maxX = Math.max(maxX, startPoint.x, endPoint.x);
      maxY = Math.max(maxY, startPoint.y, endPoint.y);
    });
  } else {
    // Fallback to using just the lines (less accurate for text height)
    const lineData = annotationData as TextUnderline | TextCrossedOut;
    lineData.lines.forEach((line) => {
      // Transform start and end points
      const startPoint = transformCoordinates(line.start.x, line.start.y, canvasWidth, canvasHeight, 1, rotation);
      const endPoint = transformCoordinates(line.end.x, line.end.y, canvasWidth, canvasHeight, 1, rotation);

      minX = Math.min(minX, startPoint.x, endPoint.x);
      minY = Math.min(minY, startPoint.y, endPoint.y);
      maxX = Math.max(maxX, startPoint.x, endPoint.x);
      maxY = Math.max(maxY, startPoint.y, endPoint.y);
    });

    // Add a larger upward extension as fallback
    const textHeight = 20;
    if (rotation === 0 || rotation === 180) {
      minY = Math.max(0, minY - textHeight);
    } else if (rotation === 90 || rotation === 270) {
      // For sideways rotation, extend in x-direction instead
      minX = Math.max(0, minX - textHeight);
    }
  }

  // Add padding (different for different annotation types)
  const padding = annotationType === 'highlight' ? 5 : 8;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(canvasWidth * scale, maxX + padding);
  maxY = Math.min(canvasHeight * scale, maxY + padding);

  const width = maxX - minX;
  const height = maxY - minY;

  if (width <= 0 || height <= 0) return null;

  // Set canvas dimensions for the captured area
  const captureWidth = width;
  const captureHeight = height;
  tempCanvas.width = captureWidth * window.devicePixelRatio;
  tempCanvas.height = captureHeight * window.devicePixelRatio;

  // Scale the canvas context
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

  // Crop and draw the PDF content - we're drawing from the actual PDF canvas which already has the rotation
  const pdfCanvas = pdfCanvasRef.current;
  ctx.drawImage(pdfCanvas, minX * scale, minY * scale, width * scale, height * scale, 0, 0, captureWidth, captureHeight);

  // Adjust annotation coordinates to be relative to the crop area and account for rotation
  let adjustedAnnotation: TextHighlight | TextUnderline | TextCrossedOut;

  switch (annotationType) {
    case 'highlight': {
      adjustedAnnotation = { ...(annotationData as TextHighlight) };
      const rects = (annotationData as TextHighlight).rects.map((rect) => {
        // Transform rectangle to rotated coordinates
        const topLeft = transformCoordinates(rect.x, rect.y, canvasWidth, canvasHeight, 1, rotation);
        const bottomRight = transformCoordinates(
          rect.x + rect.width,
          rect.y + rect.height,
          canvasWidth,
          canvasHeight,
          1,
          rotation,
        );

        // Make coordinates relative to the crop area
        return {
          x: Math.min(topLeft.x, bottomRight.x) - minX,
          y: Math.min(topLeft.y, bottomRight.y) - minY,
          width: Math.abs(bottomRight.x - topLeft.x),
          height: Math.abs(bottomRight.y - topLeft.y),
        };
      });

      (adjustedAnnotation as TextHighlight).rects = rects;

      // Use rotation 0 for rendering on the capture since we've already applied the transform
      renderTextHighlight(ctx, adjustedAnnotation as TextHighlight, captureWidth, captureHeight, 1, 0);
      break;
    }
    case 'underline': {
      adjustedAnnotation = { ...(annotationData as TextUnderline) };
      const lines = (annotationData as TextUnderline).lines.map((line) => {
        // Transform line points to rotated coordinates
        const start = transformCoordinates(line.start.x, line.start.y, canvasWidth, canvasHeight, 1, rotation);

        const end = transformCoordinates(line.end.x, line.end.y, canvasWidth, canvasHeight, 1, rotation);

        // Make coordinates relative to the crop area
        return {
          start: {
            x: start.x - minX,
            y: start.y - minY,
          },
          end: {
            x: end.x - minX,
            y: end.y - minY,
          },
        };
      });

      (adjustedAnnotation as TextUnderline).lines = lines;

      // Use rotation 0 for rendering on the capture since we've already applied the transform
      renderTextUnderline(ctx, adjustedAnnotation as TextUnderline, captureWidth, captureHeight, 1, 0);
      break;
    }
    case 'crossedout': {
      adjustedAnnotation = { ...(annotationData as TextCrossedOut) };
      const lines = (annotationData as TextCrossedOut).lines.map((line) => {
        // Transform line points to rotated coordinates
        const start = transformCoordinates(line.start.x, line.start.y, canvasWidth, canvasHeight, 1, rotation);

        const end = transformCoordinates(line.end.x, line.end.y, canvasWidth, canvasHeight, 1, rotation);

        // Make coordinates relative to the crop area
        return {
          start: {
            x: start.x - minX,
            y: start.y - minY,
          },
          end: {
            x: end.x - minX,
            y: end.y - minY,
          },
        };
      });

      (adjustedAnnotation as TextCrossedOut).lines = lines;

      // Use rotation 0 for rendering on the capture since we've already applied the transform
      renderTextCrossedOut(ctx, adjustedAnnotation as TextCrossedOut, captureWidth, captureHeight, 1, 0);
      break;
    }
  }

  // Return the image data
  return tempCanvas.toDataURL('image/png');
};
