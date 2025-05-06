import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import classes from './TextLayer.module.scss';
import { Drawing, TextHighlight, TextUnderline, TextCrossedOut } from '../../model/types/Drawings';
import { ViewerContext } from '../../model/context/viewerContext';
import { renderTextLayer } from '../../utils/renderTextLayer';
import { getLineSegments, getHighlightRects, captureTextAnnotationImage } from '../../utils/textToolUtils';

interface TextLayerProps {
  page: PDFPageProxy;
  viewport: any;
  scale: number;
  rotation: number;
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const TextLayer = (props: TextLayerProps) => {
  const { page, viewport, scale, rotation, pageNumber, onDrawingCreated, pdfCanvasRef } = props;
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [hasSelection, setHasSelection] = useState(false);

  // Get drawing color and line width from the ViewerContext
  const { state, dispatch } = useContext(ViewerContext);
  const { drawingColor, drawingLineWidth, requestFinishDrawing, requestCancelDrawing } = state;

  // Helper function to hide tools after applying
  const hideToolsAfterApplying = () => {
    setHasSelection(false);
  };

  // Handle text selection changes
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && textLayerRef.current) {
        const hasText = selection.toString().trim() !== '';
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

  // Handle document clicks to detect clicks outside the selection
  useEffect(() => {
    const handleDocumentClick = () => {
      setTimeout(() => {
        const selection = window.getSelection();
        if (!selection || selection.toString().trim() === '') {
          setHasSelection(false);
        } else {
          const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
          if (pageContainer) {
            let selectionInCurrentPage = false;

            for (let i = 0; i < selection.rangeCount; i++) {
              const range = selection.getRangeAt(i);
              if (pageContainer.contains(range.commonAncestorContainer)) {
                selectionInCurrentPage = true;
                break;
              }
            }

            if (!selectionInCurrentPage) {
              setHasSelection(false);
            }
          }
        }
      }, 10);
    };

    document.addEventListener('click', handleDocumentClick);
    return () => {
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [pageNumber]);

  // Create text underline drawing
  const createTextUnderline = () => {
    // Get line segments for the underline with rotation awareness
    const selection = window.getSelection();
    const lines = getLineSegments(selection, pageNumber, scale, textLayerRef.current || undefined, rotation);
    if (lines.length === 0) return;

    // Also get highlight rectangles to determine the correct text bounds, with rotation awareness
    const textRects = getHighlightRects(selection, pageNumber, scale, textLayerRef.current || undefined, rotation);
    if (textRects.length === 0) return;

    // Create drawing object with normalized coordinates
    const underline: TextUnderline = {
      id: '',
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

    // Capture image using both the underline data for rendering and text rectangles for determining proper capture area
    const image = pdfCanvasRef
      ? captureTextAnnotationImage('underline', underline, pageNumber, scale, pdfCanvasRef, textRects, rotation)
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
    // Get line segments for the cross-out with rotation awareness
    const selection = window.getSelection();
    const lineSegments = getLineSegments(selection, pageNumber, scale, textLayerRef.current || undefined, rotation);
    if (lineSegments.length === 0) return;

    // Also get highlight rectangles to determine the correct text bounds, with rotation awareness
    const textRects = getHighlightRects(selection, pageNumber, scale, textLayerRef.current || undefined, rotation);
    if (textRects.length === 0) return;

    // For crossed-out text, we want to create lines through the middle of each line of text
    // We'll use the line segments directly and just adjust their position
    // to go through the middle of the text instead of custom positioning

    const isVerticalText = rotation === 90 || rotation === 270;

    const crossedOutLines = lineSegments.map((line) => {
      // For crossed-out lines, we want to position them in the middle of the text height
      // We'll use the existing line segments as reference

      if (isVerticalText) {
        // For vertical text, the line should go through the middle of text width
        // The lineSegments already calculated this correctly in getLineSegments
        return line;
      } else {
        // For horizontal text, shift line up to the middle of text height
        // Estimate text height (typically around 14px)
        const estimatedTextHeight = 14 / scale;

        return {
          start: {
            x: line.start.x,
            y: line.start.y - estimatedTextHeight * 0.5,
          },
          end: {
            x: line.end.x,
            y: line.end.y - estimatedTextHeight * 0.5,
          },
        };
      }
    });

    // Create drawing object
    const crossedOut: TextCrossedOut = {
      id: '',
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

    // Capture image with rotation awareness
    const image = pdfCanvasRef
      ? captureTextAnnotationImage('crossedout', crossedOut, pageNumber, scale, pdfCanvasRef, textRects, rotation)
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
    const highlightRects = getHighlightRects(selection, pageNumber, scale, textLayerRef.current || undefined, rotation);

    if (highlightRects.length === 0) return;

    // Create drawing object
    const highlight: TextHighlight = {
      id: '',
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
    const image = pdfCanvasRef
      ? captureTextAnnotationImage('highlight', highlight, pageNumber, scale, pdfCanvasRef, undefined, rotation)
      : null;
    if (image) {
      highlight.image = image;
    }

    // Create the drawing
    onDrawingCreated(highlight);

    // Hide tools after applying
    hideToolsAfterApplying();
  };

  // Initial rendering of text layer
  useEffect(() => {
    const handleRenderTextLayer = async () => {
      if (textLayerRef.current && viewport && page) {
        await renderTextLayer(textLayerRef.current, page, viewport);
      }
    };

    handleRenderTextLayer();
  }, [page, viewport]);

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

  // Handle finish click, will be triggered by the DrawingMenu
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

  // Handle finish drawing request from DrawingMenu
  useEffect(() => {
    if (requestFinishDrawing && hasSelection) {
      handleFinishClick();
    }
  }, [requestFinishDrawing]);

  // Handle cancel drawing request from DrawingMenu
  useEffect(() => {
    if (requestCancelDrawing && hasSelection) {
      setHasSelection(false);
      dispatch({ type: 'setDrawingMode', payload: 'none' });
    }
  }, [requestCancelDrawing]);

  return (
    <>
      <div className={classes.textLayer} ref={textLayerRef} data-page-number={pageNumber}></div>
    </>
  );
};
