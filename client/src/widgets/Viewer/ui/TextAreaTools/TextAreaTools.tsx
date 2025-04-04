import React, { useContext, useState, useEffect } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { Drawing, TextHighlight, TextUnderline, TextCrossedOut } from '../../model/types/viewerSchema';
import { isLightColor, getLineSegments, getHighlightRects, captureTextAnnotationImage } from '../../utils/textToolUtils';
import styles from './TextAreaTools.module.scss';

interface TextAreaToolsProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  scale: number;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
  onHideTools?: () => void;
  textLayerElement?: HTMLElement | null;
}

export const TextAreaTools: React.FC<TextAreaToolsProps> = ({
  pageNumber,
  onDrawingCreated,
  scale,
  pdfCanvasRef,
  onHideTools,
  textLayerElement,
}) => {
  const { state } = useContext(ViewerContext);
  const { drawingColor, drawingLineWidth } = state;
  // Add state to track if tools are visible or hidden
  const [toolsVisible, setToolsVisible] = useState(true);

  // Listen for selection changes to show tools again when user makes a new selection
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim() !== '') {
        setToolsVisible(true);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Hide tools when user clicks elsewhere and clears selection
  useEffect(() => {
    const handleDocumentClick = () => {
      // Use setTimeout to allow the selection to update before checking it
      setTimeout(() => {
        const selection = window.getSelection();
        // Hide tools if selection is empty or not in the current page
        if (!selection || selection.toString().trim() === '') {
          setToolsVisible(false);
          // Notify parent component to hide copy button as well
          onHideTools?.();
        } else {
          // Check if selection is within the current page
          const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
          if (pageContainer) {
            let selectionInCurrentPage = false;

            // Check if any selected nodes are within the current page
            for (let i = 0; i < selection.rangeCount; i++) {
              const range = selection.getRangeAt(i);
              if (pageContainer.contains(range.commonAncestorContainer)) {
                selectionInCurrentPage = true;
                break;
              }
            }

            // Hide tools if selection is not in current page
            if (!selectionInCurrentPage) {
              setToolsVisible(false);
              // Notify parent component to hide copy button as well
              onHideTools?.();
            }
          }
        }
      }, 10); // Small delay to ensure selection is updated
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [pageNumber, onHideTools]);

  // Helper function to hide tools after applying
  const hideToolsAfterApplying = () => {
    setToolsVisible(false);
    // Notify parent that tools are hidden
    // Don't call onHideTools here since we want to keep copy button visible after annotation
  };

  // Create text underline drawing
  const createTextUnderline = () => {
    // Get line segments for the underline
    const selection = window.getSelection();
    const lines = getLineSegments(selection, pageNumber, scale, textLayerElement || undefined);
    if (lines.length === 0) return;

    // Also get highlight rectangles to determine the correct text bounds
    const textRects = getHighlightRects(selection, pageNumber, scale, textLayerElement || undefined);
    if (textRects.length === 0) return;

    // Create drawing object
    const underline: TextUnderline = {
      type: 'textUnderline',
      pageNumber,
      lines,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth / scale,
      },
      boundingBox: {
        left: Math.min(...lines.flatMap((line) => [line.start.x, line.end.x])),
        top: Math.min(...lines.flatMap((line) => [line.start.y, line.end.y])),
        right: Math.max(...lines.flatMap((line) => [line.start.x, line.end.x])),
        bottom: Math.max(...lines.flatMap((line) => [line.start.y, line.end.y])),
      },
    };

    // Capture image using both the underline data for rendering
    // and text rectangles for determining proper capture area
    const image = pdfCanvasRef
      ? captureTextAnnotationImage('underline', underline, pageNumber, scale, pdfCanvasRef, textRects)
      : null;
    if (image) {
      underline.image = image;
    }

    // Create the drawing
    onDrawingCreated(underline);

    // Hide tools after applying
    hideToolsAfterApplying();
  };

  // Create text crossed out drawing (strikethrough)
  const createTextCrossedOut = () => {
    // Get line segments for the cross-out
    const selection = window.getSelection();
    const lineSegments = getLineSegments(selection, pageNumber, scale, textLayerElement || undefined);
    if (lineSegments.length === 0) return;

    // Also get highlight rectangles to determine the correct text bounds
    const textRects = getHighlightRects(selection, pageNumber, scale, textLayerElement || undefined);
    if (textRects.length === 0) return;

    // Create a map of lines by y-position (rounded to nearest integer) for grouping
    const textRectsByY = new Map();

    // Group text rectangles by their y-position (approximately)
    textRects.forEach((rect) => {
      // Use the middle of the rectangle for y position grouping
      const yKey = Math.floor(rect.y + rect.height / 2);
      if (!textRectsByY.has(yKey)) {
        textRectsByY.set(yKey, []);
      }
      textRectsByY.get(yKey).push(rect);
    });

    // Process the line segments to create crossed-out lines in the center of text
    const crossedOutLines = lineSegments.map((line) => {
      // Try to find matching text rectangles for this line based on y position
      const lineY = Math.floor(line.start.y); // Bottom of the text line

      // Find the nearest group of text rectangles
      let nearestY = lineY;
      let minDistance = Infinity;

      for (const [y] of textRectsByY.entries()) {
        const distance = Math.abs(y - lineY);
        if (distance < minDistance) {
          minDistance = distance;
          nearestY = y;
        }
      }

      // Get the text rectangles for this line
      const rectsForLine = textRectsByY.get(nearestY) || [];

      if (rectsForLine.length > 0) {
        // Calculate average height of text for this line
        const avgHeight =
          rectsForLine.reduce((sum: number, rect: { height: number }) => sum + rect.height, 0) / rectsForLine.length;

        // Find the top-most position for this line
        const topY = Math.min(...rectsForLine.map((rect: { y: number }) => rect.y));

        // Calculate middle of text (approximately 50% from top for most fonts)
        // Adjusted to be more centered (moved down from previous 40%)
        const middleY = topY + avgHeight * 0.5;

        // Create a new line with adjusted y position for center of text
        return {
          start: { x: line.start.x, y: middleY },
          end: { x: line.end.x, y: middleY },
        };
      }

      // If no matching text rectangles found, make an educated guess
      // Move the line up by approximately 60% of the typical line height
      const estimatedLineHeight = 14 / scale; // Typical line height
      // Adjust the fallback position to be more centered
      const estimatedMiddleY = line.start.y - estimatedLineHeight * 0.5;

      return {
        start: { x: line.start.x, y: estimatedMiddleY },
        end: { x: line.end.x, y: estimatedMiddleY },
      };
    });

    // Create drawing object
    const crossedOut: TextCrossedOut = {
      type: 'textCrossedOut',
      pageNumber,
      lines: crossedOutLines,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth / scale,
      },
      boundingBox: {
        left: Math.min(...crossedOutLines.flatMap((line) => [line.start.x, line.end.x])),
        top: Math.min(...crossedOutLines.flatMap((line) => [line.start.y, line.end.y])),
        right: Math.max(...crossedOutLines.flatMap((line) => [line.start.x, line.end.x])),
        bottom: Math.max(...crossedOutLines.flatMap((line) => [line.start.y, line.end.y])),
      },
    };

    // Capture image using both the cross-out data for rendering
    // and text rectangles for determining proper capture area
    const image = pdfCanvasRef
      ? captureTextAnnotationImage('crossedout', crossedOut, pageNumber, scale, pdfCanvasRef, textRects)
      : null;
    if (image) {
      crossedOut.image = image;
    }

    // Create the drawing
    onDrawingCreated(crossedOut);

    // Hide tools after applying
    hideToolsAfterApplying();
  };

  // Create text highlight drawing
  const createTextHighlight = () => {
    // Get rectangles for highlighting
    const selection = window.getSelection();
    const highlightRects = getHighlightRects(selection, pageNumber, scale, textLayerElement || undefined);

    if (highlightRects.length === 0) return;

    // Create drawing object
    const highlight: TextHighlight = {
      type: 'textHighlight',
      pageNumber,
      rects: highlightRects,
      style: {
        strokeColor: drawingColor,
        strokeWidth: 1 / scale, // Thin border
      },
      opacity: 0.3, // 30% opacity for highlighting
      boundingBox: {
        left: Math.min(...highlightRects.flatMap((rect) => [rect.x, rect.x + rect.width])),
        top: Math.min(...highlightRects.flatMap((rect) => [rect.y, rect.y + rect.height])),
        right: Math.max(...highlightRects.flatMap((rect) => [rect.x, rect.x + rect.width])),
        bottom: Math.max(...highlightRects.flatMap((rect) => [rect.y, rect.y + rect.height])),
      },
    };

    // Capture image
    const image = pdfCanvasRef ? captureTextAnnotationImage('highlight', highlight, pageNumber, scale, pdfCanvasRef) : null;
    if (image) {
      highlight.image = image;
    }

    // Create the drawing
    onDrawingCreated(highlight);

    // Hide tools after applying
    hideToolsAfterApplying();
  };

  // Only render the buttons if tools are visible
  if (!toolsVisible) {
    return null;
  }

  return (
    <div className={styles.textToolsContainer}>
      <button
        className={styles.textToolButton}
        onClick={createTextUnderline}
        title='Underline text'
        style={{ backgroundColor: drawingColor }}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'>
          <path d='M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3' />
          <line x1='4' y1='21' x2='20' y2='21' />
        </svg>
        <span>Underline</span>
      </button>

      <button
        className={styles.textToolButton}
        onClick={createTextCrossedOut}
        title='Cross out text'
        style={{ backgroundColor: drawingColor }}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'>
          <line x1='4' y1='12' x2='20' y2='12' />
          <path d='M6 20v-8a6 6 0 0 1 12 0v8' />
        </svg>
        <span>Cross Out</span>
      </button>

      <button
        className={styles.textToolButton}
        onClick={createTextHighlight}
        title='Highlight text'
        style={{
          backgroundColor: drawingColor,
          color: isLightColor(drawingColor) ? '#333' : 'white',
        }}>
        <svg
          xmlns='http://www.w3.org/2000/svg'
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'>
          <rect x='3' y='5' width='18' height='14' rx='2' ry='2' />
          <path d='M8 5v14' />
          <path d='M16 5v14' />
        </svg>
        <span>Highlight</span>
      </button>
    </div>
  );
};

export default TextAreaTools;
