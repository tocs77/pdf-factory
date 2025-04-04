import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import classes from './TextLayer.module.scss';
import TextAreaTools from '../TextAreaTools/TextAreaTools';
import { Drawing } from '../../model/types/viewerSchema';
import { renderTextLayer } from '../../utils/renderTextLayer';

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
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [showCopyButton, setShowCopyButton] = useState(false);

  // Remove dragging-related state
  const [toolbarPosition, setToolbarPosition] = useState({ top: 60, left: 10 });

  // Handle text selection
  useEffect(() => {
    if (!textLayerRef.current) {
      return;
    }

    const textLayer = textLayerRef.current;

    // Add text layer styles class
    textLayer.classList.add(classes.textLayer);

    const handleSelectionStart = (e: MouseEvent) => {
      if (textLayer.contains(e.target as Node)) {
        setIsSelecting(true);
        textLayer.classList.add(classes.selecting);
      }
    };

    const handleSelectionEnd = () => {
      setIsSelecting(false);

      // Remove selecting class
      textLayer.classList.remove(classes.selecting);

      const selection = window.getSelection();
      if (!selection) return;

      // Check if selection is within our text layer or if we were in selection mode
      let isInTextLayer = false;
      if (selection.anchorNode && textLayer.contains(selection.anchorNode)) {
        isInTextLayer = true;
      }

      if (isInTextLayer || isSelecting) {
        setHasSelection(true);

        // Add hasSelection class to keep text visible
        textLayer.classList.add(classes.hasSelection);
      } else {
        setHasSelection(false);

        // Remove hasSelection class when no text is selected
        textLayer.classList.remove(classes.hasSelection);
      }
    };

    // Track selection changes
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection?.toString().trim()) {
        // Check if selection intersects with our text layer
        let intersectsTextLayer = false;

        if (textLayerRef.current) {
          // Check all ranges in the selection
          for (let i = 0; i < selection.rangeCount; i++) {
            const range = selection.getRangeAt(i);
            const textLayerRect = textLayerRef.current.getBoundingClientRect();
            const rangeRect = range.getBoundingClientRect();

            // Check if the range intersects with the text layer
            if (
              !(
                rangeRect.right < textLayerRect.left ||
                rangeRect.left > textLayerRect.right ||
                rangeRect.bottom < textLayerRect.top ||
                rangeRect.top > textLayerRect.bottom
              )
            ) {
              intersectsTextLayer = true;
              break;
            }
          }
        }

        if (intersectsTextLayer || isSelecting) {
          // Keep the text layer visible during selection
          if (textLayerRef.current) {
            textLayerRef.current.classList.add(classes.selecting);
          }
        }
      } else if (!isSelecting && textLayerRef.current) {
        // If not actively selecting and no text is selected, remove the selecting class
        if (!hasSelection) {
          textLayerRef.current.classList.remove(classes.selecting);
        }
      }
    };

    // Clear selection when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      // Don't hide if clicking on any part of the toolbar or buttons
      const isClickingToolbar = !!(e.target as HTMLElement).closest(`.${classes.textSelectionToolbar}`);
      const isClickingTextButton = !!(e.target as HTMLElement).closest(`.${classes.copyButton}`);

      if (
        hasSelection &&
        textLayerRef.current &&
        !textLayerRef.current.contains(e.target as Node) &&
        !isClickingToolbar &&
        !isClickingTextButton
      ) {
        // Only clear if we're not clicking the copy button or toolbar
        const selection = window.getSelection();
        if (selection) {
          // Check if we should clear the selection
          const shouldClear =
            !isSelecting && (!selection.toString().trim() || !textLayerRef.current.contains(selection.anchorNode as Node));

          if (shouldClear) {
            setHasSelection(false);
            setShowCopyButton(false);

            // Remove hasSelection class
            if (textLayerRef.current) {
              textLayerRef.current.classList.remove(classes.hasSelection);
              textLayerRef.current.classList.remove(classes.selecting);
            }
          }
        }
      }
    };

    document.addEventListener('mousedown', handleSelectionStart);
    document.addEventListener('mouseup', handleSelectionEnd);
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keyup', handleSelectionEnd);

    return () => {
      document.removeEventListener('mousedown', handleSelectionStart);
      document.removeEventListener('mouseup', handleSelectionEnd);
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keyup', handleSelectionEnd);
    };
  }, [isSelecting, hasSelection]);

  // Hide copy button when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Don't hide if clicking on any part of the toolbar or buttons
      const isClickingToolbar = !!(e.target as HTMLElement).closest(`.${classes.textSelectionToolbar}`);
      const isClickingTextButton = !!(e.target as HTMLElement).closest(`.${classes.copyButton}`);

      if (
        showCopyButton &&
        !isClickingToolbar &&
        !isClickingTextButton &&
        textLayerRef.current &&
        !textLayerRef.current.contains(e.target as Node)
      ) {
        // Use setTimeout to check if the selection is still valid after the click
        setTimeout(() => {
          const selection = window.getSelection();
          if (!selection || selection.toString().trim() === '') {
            setShowCopyButton(false);
            setHasSelection(false);
          }
        }, 10);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCopyButton]);

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

  // Render text layer content
  useEffect(() => {
    const handleRenderTextLayer = async () => {
      if (!textLayerRef.current || !viewport || !renderTask || !page) {
        return;
      }

      try {
        await renderTextLayer(textLayerRef.current, page, viewport, renderTask);
      } catch (error) {
        console.error('Error rendering text layer:', error);
      }
    };

    handleRenderTextLayer();
  }, [page, viewport, scale, rotation, renderTask]);

  // Set fixed position for toolbar that stays in view
  useEffect(() => {
    if (!hasSelection) return;

    // Set position in the viewport that's always visible
    const viewportWidth = window.innerWidth;

    setToolbarPosition({
      top: 120,
      left: Math.min(viewportWidth - 200, Math.max(10, 10)), // Ensure toolbar is visible in viewport
    });

    // Update position on resize
    const handleResize = () => {
      const newViewportWidth = window.innerWidth;
      setToolbarPosition({
        top: 120,
        left: Math.min(newViewportWidth - 200, Math.max(10, 10)),
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [hasSelection]);

  return (
    <>
      <div
        ref={textLayerRef}
        className={classes.textLayer}
        onMouseUp={() => {
          // Force selection change check after mouse up
          const selection = window.getSelection();
          if (selection && selection.toString().trim()) {
            setShowCopyButton(true);
            setHasSelection(true);

            // Force a selectionchange event to trigger the TextAreaTools
            const event = new Event('selectionchange', {
              bubbles: true,
              cancelable: true,
            });
            document.dispatchEvent(event);
          }
        }}
      />

      {/* Text selection toolbar with simplified fixed position */}
      {hasSelection && (
        <div
          className={classes.textSelectionToolbar}
          style={{
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
          }}>
          <TextAreaTools
            pageNumber={pageNumber}
            onDrawingCreated={(drawing) => {
              onDrawingCreated(drawing);
              // Make sure to clear selection after creating drawing
              setHasSelection(false);
              setShowCopyButton(false);
            }}
            scale={scale}
            pdfCanvasRef={pdfCanvasRef}
            onHideTools={() => {
              // Hide copy button and reset selection state
              setShowCopyButton(false);
              setHasSelection(false);
            }}
            textLayerElement={textLayerRef.current}
          />
        </div>
      )}
    </>
  );
};
