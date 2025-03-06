import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import * as pdfjs from 'pdfjs-dist';
import classes from './Page.module.scss';
import { classNames } from '@/shared/utils';
import DrawingComponent from '../DrawingComponent/DrawingComponent';
import DrawRect from '../DrawRect/DrawRect';
import PinDrawingComponent from '../PinDrawingComponent/PinDrawingComponent';
import CompleteDrawings from '../CompleteDrawings/CompleteDrawings';
import { ViewerContext } from '../../model/context/viewerContext';

// Page component for rendering a single PDF page
interface PageProps {
  page: PDFPageProxy;
  scale: number;
  pageNumber: number;
  id: string;
  className?: string;
}

export const Page = ({
  page,
  scale,
  pageNumber,
  id,
  className,
}: PageProps) => {
  const { state } = useContext(ViewerContext);
  const { textLayerEnabled, drawingMode, pageRotations } = state;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showCopyButton, setShowCopyButton] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [inView, setInView] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  
  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  // Use Intersection Observer to detect when the page is visible
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(entry.isIntersecting);
      },
      {
        rootMargin: '200px 0px', // Load pages 200px above and below viewport
        threshold: 0.01, // Trigger when at least 1% of the page is visible
      },
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Only render when page is visible (or when explicitly set to visible)
  const shouldRender = inView || hasRendered;

  // Handle text selection
  useEffect(() => {
    if (!textLayerEnabled || !textLayerRef.current) {
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
      if (
        hasSelection &&
        textLayerRef.current &&
        !textLayerRef.current.contains(e.target as Node) &&
        !(e.target as HTMLElement).classList.contains(classes.copyButton)
      ) {
        // Only clear if we're not clicking the copy button
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
  }, [textLayerEnabled, isSelecting, hasSelection]);

  // Hide copy button when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        showCopyButton &&
        !(e.target as HTMLElement).classList.contains(classes.copyButton) &&
        textLayerRef.current &&
        !textLayerRef.current.contains(e.target as Node)
      ) {
        setShowCopyButton(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCopyButton]);

  useEffect(() => {
    let isMounted = true;
    let renderTask: ReturnType<typeof page.render> | null = null;

    const renderPage = async () => {
      // Skip rendering if the page isn't visible
      if (!canvasRef.current || !shouldRender) return;

      // If already rendered once, don't re-render
      if (hasRendered) return;

      // Create viewport with rotation
      // For 90/270 degree rotations, we need to ensure the viewport maintains the correct aspect ratio
      const viewport = page.getViewport({ 
        scale, 
        rotation,
        // Enable dontFlip to ensure consistent rendering across different rotations
        dontFlip: false
      });
      const canvas = canvasRef.current;
      
      // Get the parent container for proper sizing
      const parent = canvas.parentElement;
      if (!parent) {
        console.warn('Canvas parent element not found');
        return;
      }

      // Apply quality multiplier to canvas dimensions for higher resolution rendering
      const outputScale = window.devicePixelRatio || 1;
      const totalScale = outputScale;
      
      // Determine if we need to adjust for rotation (90 or 270 degrees)
      const isRotated90or270 = rotation === 90 || rotation === 270;
      
      // Set display size based on viewport dimensions
      // For 90/270 degree rotations, we need to adjust the container to maintain aspect ratio
      if (isRotated90or270) {
        // For rotated pages, we need to adjust the container size to maintain aspect ratio
        // Set the container dimensions to maintain the correct aspect ratio
        parent.style.width = `${Math.floor(viewport.width)}px`;
        parent.style.height = `${Math.floor(viewport.height)}px`;
        
        // Set canvas dimensions to match viewport
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
      } else {
        // For normal orientation, just set dimensions directly
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
      }

      // Set actual size in memory (scaled to account for device pixel ratio and quality)
      canvas.width = Math.floor(viewport.width * totalScale);
      canvas.height = Math.floor(viewport.height * totalScale);

      // Get context and scale it
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.scale(totalScale, totalScale);

      const renderContext = {
        canvasContext: ctx,
        viewport,
      };

      try {
        renderTask = page.render(renderContext);
        await renderTask.promise;
        
        // Render text layer if enabled
        if (textLayerEnabled && textLayerRef.current) {
          const textLayerDiv = textLayerRef.current;

          // Clear previous text layer content
          textLayerDiv.innerHTML = '';

          // Ensure text layer has the exact same dimensions as the canvas
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

          // Ensure text layer is positioned exactly over the canvas
          textLayerDiv.style.left = '0';
          textLayerDiv.style.top = '0';
          textLayerDiv.style.position = 'absolute';

          // Remove any transform or transformOrigin from the container
          textLayerDiv.style.transform = '';
          textLayerDiv.style.transformOrigin = '';

          try {
            // Wait for canvas rendering to complete first
            await renderTask.promise;

            if (!isMounted) return;

            try {
              // Get text content
              const textContent = await page.getTextContent({
                includeMarkedContent: true,
              });

              if (!isMounted) return;

              // Check if textContent is valid
              if (!textContent || !Array.isArray(textContent.items) || textContent.items.length === 0) {
                return; // Skip further processing if invalid
              }

              // Define a proper type for text content items
              interface TextItem {
                str?: string;
                type?: string;
                transform?: number[];
                fontName?: string;
                [key: string]: unknown;
              }

              // Create text layer items with proper positioning
              const textItems = textContent.items
                .filter((item: TextItem) => {
                  // Only process actual text items
                  // Skip marked content items, which have types like 'beginMarkedContent'
                  if (item.type?.startsWith('beginMarkedContent')) {
                    return false;
                  }
                  
                  // Skip endMarkedContent items as well
                  if (item.type === 'endMarkedContent') {
                    return false;
                  }
  
                  // Ensure items have string content
                  // Allow whitespace strings if they have valid transform data
                  if (item.str === undefined) {
                    return false;
                  }
                  
                  // Only filter out completely empty strings, not whitespace
                  if (item.str === '') {
                    return false;
                  }

                  // Ensure items have valid transform data
                  if (!item.transform) {
                    return false;
                  }
                  
                  if (item.transform.length < 6) {
                    return false;
                  }
                  
                  return true;
                })
                .map((item: TextItem) => {
                  try {
                    // Transform coordinates
                    const tx = pdfjs.Util.transform(viewport.transform, item.transform);

                    // Skip if transform failed
                    if (!tx || tx.length < 6) {
                      return null;
                    }

                    // Calculate font height and rotation angle
                    const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
                    const angle = Math.atan2(tx[1], tx[0]);

                    // Create text span element
                    const textDiv = document.createElement('span');
                    if (item.str) {
                      textDiv.textContent = item.str;
                      
                      // Add special handling for whitespace-only strings
                      if (item.str.trim() === '' && item.str.length > 0) {
                        // Ensure whitespace has a minimum width
                        textDiv.style.minWidth = '4px';
                        textDiv.style.display = 'inline-block';
                      }
                    }

                    // Set positioning styles with precise calculations
                    textDiv.style.position = 'absolute';

                    // Apply exact positioning based on the viewport transform
                    // This ensures text is positioned exactly where it should be on the canvas
                    const left = tx[4];
                    const top = tx[5] - fontHeight;

                    textDiv.style.left = `${left}px`;
                    textDiv.style.top = `${top}px`;
                    textDiv.style.fontSize = `${fontHeight}px`;
                    textDiv.style.fontFamily = 'sans-serif';

                    // Apply rotation if needed
                    if (angle !== 0) {
                      textDiv.style.transform = `rotate(${angle}rad)`;
                      textDiv.style.transformOrigin = 'left bottom';
                    }

                    // Ensure text doesn't wrap
                    textDiv.style.whiteSpace = 'pre';

                    // Add text selection properties
                    if (item.fontName) {
                      textDiv.dataset.fontName = item.fontName as string;
                    }

                    // Add event listeners to improve selection behavior
                    textDiv.addEventListener('mousedown', (e) => {
                      // Prevent default to avoid issues with text selection
                      e.stopPropagation();
                    });

                    return textDiv;
                  } catch (_err) {
                    return null;
                  }
                })
                .filter((item) => item !== null);

              if (!isMounted) return;

              // Fallback: If no text items passed the filter but there are actual text items in the content,
              // create a simplified version of the text layer
              if (textItems.length === 0 && textContent.items.length > 0) {
                // Create a fallback text layer with just the text content
                const fallbackItems = textContent.items
                  .filter((item: TextItem) => {
                    // Only include items with actual text content
                    return item.str && item.str.trim() !== '' && item.transform && item.transform.length >= 6;
                  })
                  .map((item: TextItem) => {
                    try {
                      // Transform coordinates
                      const tx = pdfjs.Util.transform(viewport.transform, item.transform);
                      
                      if (!tx || tx.length < 6) return null;
                      
                      // Create a simple text element
                      const textDiv = document.createElement('span');
                      textDiv.textContent = item.str || '';
                      textDiv.style.position = 'absolute';
                      
                      // Position it based on the transform
                      const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
                      textDiv.style.left = `${tx[4]}px`;
                      textDiv.style.top = `${tx[5] - fontHeight}px`;
                      textDiv.style.fontSize = `${fontHeight}px`;
                      textDiv.style.fontFamily = 'sans-serif';
                      
                      return textDiv;
                    } catch (_err) {
                      return null;
                    }
                  })
                  .filter(item => item !== null);
                
                // Use the fallback items instead
                if (fallbackItems.length > 0) {
                  // Create a document fragment for better performance
                  const fragment = document.createDocumentFragment();
                  
                  // Append all fallback items
                  for (const item of fallbackItems) {
                    if (item) fragment.appendChild(item);
                  }
                  
                  // Append to the text layer
                  if (textLayerDiv && isMounted) {
                    textLayerDiv.appendChild(fragment);
                  }
                }
              } else {
                // Create a document fragment for better performance
                const fragment = document.createDocumentFragment();
  
                // Use for...of instead of forEach
                for (const item of textItems) {
                  if (item) fragment.appendChild(item);
                }
  
                // Append all text items to the text layer at once
                if (textLayerDiv && isMounted) {
                  textLayerDiv.appendChild(fragment);
                }
              }
            } catch (_textError) {
              throw new Error('Failed to render text layer');
            }
          } catch (_error) {
            // Add a fallback message to the text layer
            if (textLayerRef.current && isMounted) {
              const errorMessage = document.createElement('div');
              errorMessage.className = classes.textLayerError;
              errorMessage.textContent = 'Failed to render text layer';
              textLayerRef.current.appendChild(errorMessage);
            }
          }
        }
        
        if (isMounted) {
          setHasRendered(true);
        }
      } catch (error) {
        console.error('Error rendering PDF page:', error);
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [page, scale, shouldRender, hasRendered, textLayerEnabled, rotation]);

  // Re-render when rotation changes
  useEffect(() => {
    // Reset hasRendered to force re-rendering when rotation changes
    setHasRendered(false);
  }, [rotation]);

  // Re-render when scale changes
  useEffect(() => {
    // Reset hasRendered to force re-rendering when scale changes
    setHasRendered(false);
  }, [scale]);

  // Copy selected text
  const copySelectedText = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim()) {
      navigator.clipboard.writeText(selection.toString());
      
      // Show feedback
      const button = document.querySelector(`.${classes.copyButton}`);
      if (button) {
        button.textContent = 'Copied!';
        setTimeout(() => {
          if (button) {
            button.textContent = 'Copy';
          }
        }, 2000);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className={classNames(classes.pageContainer, {}, [className])}
      id={id}
      data-page-number={pageNumber}
      style={{
        // Apply special styles for rotated pages to maintain aspect ratio
        ...(rotation === 90 || rotation === 270 ? {
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        } : {})
      }}
    >
      <div 
        ref={pageRef} 
        className={classes.page}
        style={{
          // Ensure the page container adapts to rotation
          ...(rotation === 90 || rotation === 270 ? {
            width: 'auto',
            height: 'auto',
          } : {})
        }}
      >
        <div 
          ref={canvasWrapperRef} 
          className={classes.canvasWrapper}
          style={{
            // Ensure the canvas wrapper adapts to rotation
            ...(rotation === 90 || rotation === 270 ? {
              width: 'auto',
              height: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
            } : {})
          }}
        >
          <canvas ref={canvasRef} className={classes.pageCanvas} />
          
          {textLayerEnabled && (
            <div
              ref={textLayerRef}
              className={classes.textLayer}
              onMouseUp={() => {
                const selection = window.getSelection();
                if (selection && selection.toString().trim()) {
                  setShowCopyButton(true);
                }
              }}
            />
          )}
          
          {showCopyButton && (
            <button className={classes.copyButton} onClick={copySelectedText}>
              Copy
            </button>
          )}
          
          {/* Drawing components - only render when text layer is disabled */}
          {!textLayerEnabled && (
            <>
              {drawingMode === 'freehand' && <DrawingComponent pageNumber={pageNumber} />}
              {drawingMode === 'rectangle' && <DrawRect pageNumber={pageNumber} />}
              {drawingMode === 'pin' && <PinDrawingComponent pageNumber={pageNumber} />}
            </>
          )}
          
          {/* Always render completed drawings */}
          <CompleteDrawings pageNumber={pageNumber} scale={scale} rotation={rotation} />
        </div>
      </div>
    </div>
  );
};
