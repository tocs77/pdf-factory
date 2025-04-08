import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import classes from './TextLayer.module.scss';
import TextAreaTools from '../TextAreaTools/TextAreaTools';
import { Drawing, TextHighlight, TextUnderline, TextCrossedOut } from '../../model/types/viewerSchema';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderTextLayer } from '../../utils/renderTextLayer';
import { getLineSegments, getHighlightRects, captureTextAnnotationImage } from '../../utils/textToolUtils';

interface TextLayerProps {
  page: PDFPageProxy;
  viewport: any;
  scale: number;
  rotation: number;
  renderTask: any;
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const TextLayer = ({
  page,
  viewport,
  scale,
  rotation,
  renderTask,
  pageNumber,
  onDrawingCreated,
  pdfCanvasRef,
}: TextLayerProps) => {
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [hasSelection, setHasSelection] = useState(false);

  // Get drawing color and line width from the ViewerContext
  const { state, dispatch } = useContext(ViewerContext);
  const { drawingColor, drawingLineWidth } = state;

  // Helper function to hide tools after applying
  const hideToolsAfterApplying = () => {
    setHasSelection(false);
  };

  // Create text underline drawing
  const createTextUnderline = () => {
    // Get line segments for the underline
    const selection = window.getSelection();
    const lines = getLineSegments(selection, pageNumber, scale, textLayerRef.current || undefined);
    if (lines.length === 0) return;

    // Also get highlight rectangles to determine the correct text bounds
    const textRects = getHighlightRects(selection, pageNumber, scale, textLayerRef.current || undefined);
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
    const lineSegments = getLineSegments(selection, pageNumber, scale, textLayerRef.current || undefined);
    if (lineSegments.length === 0) return;

    // Also get highlight rectangles to determine the correct text bounds
    const textRects = getHighlightRects(selection, pageNumber, scale, textLayerRef.current || undefined);
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
        const middleY = topY + avgHeight * 0.5;

        // Create a new line with adjusted y position for center of text
        return {
          start: { x: line.start.x, y: middleY },
          end: { x: line.end.x, y: middleY },
        };
      }

      // If no matching text rectangles found, make an educated guess
      // Move the line up by approximately 50% of the typical line height
      const estimatedLineHeight = 14 / scale; // Typical line height
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
    const highlightRects = getHighlightRects(selection, pageNumber, scale, textLayerRef.current || undefined);

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

  // Handle text selection
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && textLayerRef.current) {
        const hasText = selection.toString().trim() !== '';

        // Set flags based on selection state
        setHasSelection(hasText);
      }
    };

    // Add event listener for text selection
    document.addEventListener('selectionchange', handleSelectionChange);

    // Clean up event listener on unmount
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, []);

  // Initial rendering of text layer
  useEffect(() => {
    const handleRenderTextLayer = async () => {
      if (textLayerRef.current && viewport && renderTask && page) {
        await renderTextLayer(textLayerRef.current, page, viewport, renderTask);
      }
    };

    handleRenderTextLayer();
  }, [page, viewport, renderTask]);

  // Ensure text layer is properly positioned when rotation changes
  useEffect(() => {
    if (!textLayerRef.current || !viewport) return;

    const textLayerDiv = textLayerRef.current;

    // Always ensure the text layer has position: absolute
    textLayerDiv.style.position = 'absolute';

    // Get dimensions from viewport - these already account for rotation
    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);

    // Reset all transform properties
    textLayerDiv.style.transform = '';
    textLayerDiv.style.transformOrigin = '';

    // Position at the top-left corner
    textLayerDiv.style.left = '0';
    textLayerDiv.style.top = '0';

    // Set dimensions to match the viewport exactly
    textLayerDiv.style.width = `${width}px`;
    textLayerDiv.style.height = `${height}px`;

    // No rotation transforms needed as PDF.js viewport already handles rotation
  }, [rotation, viewport]);

  const handleFinishClick = () => {
    switch (state.drawingMode) {
      case 'textUnderline':
        createTextUnderline();
        break;
      case 'textCrossedOut':
        createTextCrossedOut();
        break;
      case 'textHighlight':
        createTextHighlight();
        break;
      default:
        break;
    }
    setHasSelection(false);
    dispatch({ type: 'setDrawingMode', payload: 'none' });
  };

  return (
    <>
      {/* Add text tools menu when text is selected */}
      {hasSelection && (
        <div
          className={classes.textSelectionToolbar}
          style={{
            position: 'fixed',
            top: '120px',
            right: '20px',
            zIndex: 1000,
            width: '160px', // Slightly narrower to better fit content
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
            borderRadius: '4px',
            backgroundColor: 'white',
            padding: '10px',
          }}>
          <TextAreaTools
            pageNumber={pageNumber}
            onFinishClick={handleFinishClick}
            onHideTools={() => {
              setHasSelection(false);
            }}
            textLayerElement={textLayerRef.current}
          />
        </div>
      )}
      <div className={classes.textLayer} ref={textLayerRef} data-page-number={pageNumber}></div>
    </>
  );
};
