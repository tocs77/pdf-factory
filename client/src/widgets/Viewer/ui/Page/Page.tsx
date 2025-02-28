import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import * as pdfjs from 'pdfjs-dist';
import styles from './Page.module.scss';

// Page component for rendering a single PDF page
interface PageProps {
  page: PDFPageProxy;
  scale: number;
  pageNumber: number;
  id: string;
  /** Quality multiplier for rendering resolution (default: 1) */
  quality?: number;
  /** Whether to enable the text layer for selection (default: true) */
  textLayerEnabled?: boolean;
  /** Drawing color for annotation (default: blue) */
  drawingColor?: string;
  /** Drawing line width (default: 2) */
  drawingLineWidth?: number;
  /** Whether the page is currently visible in the viewport (default: false) */
  isVisible?: boolean;
}

export const Page = ({ 
  page, 
  scale, 
  pageNumber, 
  id, 
  quality = 1, 
  textLayerEnabled = true,
  drawingColor = '#2196f3',
  drawingLineWidth = 2,
  isVisible = false
}: PageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderProgress, setRenderProgress] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const [showCopyButton, setShowCopyButton] = useState(false);
  const [copyButtonPosition, setCopyButtonPosition] = useState({ x: 0, y: 0 });
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPosition, setLastPosition] = useState({ x: 0, y: 0 });
  const [inView, setInView] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const prevScaleRef = useRef(scale);
  const prevQualityRef = useRef(quality);
  const renderProgressRef = useRef(renderProgress);

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
        threshold: 0.01 // Trigger when at least 1% of the page is visible
      }
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Only render when page is visible (or when explicitly set to visible)
  const shouldRender = isVisible || inView;

  // Handle text selection
  useEffect(() => {
    if (!textLayerEnabled || !textLayerRef.current) {
      return;
    }

    const textLayer = textLayerRef.current;
    
    // Add text layer styles class
    textLayer.classList.add(styles.textLayer);

    const handleSelectionStart = (e: MouseEvent) => {
      if (textLayer.contains(e.target as Node)) {
        setIsSelecting(true);
        textLayer.classList.add(styles.selecting);
      }
    };

    const handleSelectionEnd = () => {
      setIsSelecting(false);
      
      // Remove selecting class
      textLayer.classList.remove(styles.selecting);
      
      const selection = window.getSelection();
      if (!selection) return;
      
      // Check if selection is within our text layer or if we were in selection mode
      let isInTextLayer = false;
      if (selection.anchorNode && textLayer.contains(selection.anchorNode)) {
        isInTextLayer = true;
      }
      
      if (isInTextLayer || isSelecting) {
        const text = selection.toString().trim();
        setSelectedText(text);

        if (text) {
          // Get selection coordinates to position the copy button
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Position the button above the selection
          setCopyButtonPosition({
            x: rect.left + window.scrollX + rect.width / 2,
            y: rect.top + window.scrollY - 30,
          });

          setShowCopyButton(true);
          setHasSelection(true);
          
          // Add hasSelection class to keep text visible
          textLayer.classList.add(styles.hasSelection);
        } else {
          setShowCopyButton(false);
          setHasSelection(false);
          
          // Remove hasSelection class when no text is selected
          textLayer.classList.remove(styles.hasSelection);
        }
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
            if (!(rangeRect.right < textLayerRect.left || 
                  rangeRect.left > textLayerRect.right || 
                  rangeRect.bottom < textLayerRect.top || 
                  rangeRect.top > textLayerRect.bottom)) {
              intersectsTextLayer = true;
              break;
            }
          }
        }
        
        if (intersectsTextLayer || isSelecting) {
          // Keep the text layer visible during selection
          if (textLayerRef.current) {
            textLayerRef.current.classList.add(styles.selecting);
          }
        }
      } else if (!isSelecting && textLayerRef.current) {
        // If not actively selecting and no text is selected, remove the selecting class
        if (!hasSelection) {
          textLayerRef.current.classList.remove(styles.selecting);
        }
      }
    };

    // Clear selection when clicking outside
    const handleClickOutside = (e: MouseEvent) => {
      if (hasSelection && 
          textLayerRef.current && 
          !textLayerRef.current.contains(e.target as Node) &&
          !(e.target as HTMLElement).classList.contains(styles.copyButton)) {
        
        // Only clear if we're not clicking the copy button
        const selection = window.getSelection();
        if (selection) {
          // Check if we should clear the selection
          const shouldClear = !isSelecting && 
                             (!selection.toString().trim() || 
                              !textLayerRef.current.contains(selection.anchorNode as Node));
          
          if (shouldClear) {
            setHasSelection(false);
            setShowCopyButton(false);
            
            // Remove hasSelection class
            if (textLayerRef.current) {
              textLayerRef.current.classList.remove(styles.hasSelection);
              textLayerRef.current.classList.remove(styles.selecting);
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

  // Handle copy button click
  const handleCopy = () => {
    if (selectedText) {
      navigator.clipboard
        .writeText(selectedText)
        .then(() => {
          setCopySuccess(true);
          setTimeout(() => {
            setCopySuccess(false);
            setShowCopyButton(false);
            setHasSelection(false);
            
            // Remove hasSelection class after copying
            if (textLayerRef.current) {
              textLayerRef.current.classList.remove(styles.hasSelection);
            }
          }, 1500);
        })
        .catch((err) => {
          console.error('Failed to copy text: ', err);
        });
    }
  };

  // Hide copy button when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showCopyButton && 
          !(e.target as HTMLElement).classList.contains(styles.copyButton) && 
          textLayerRef.current && 
          !textLayerRef.current.contains(e.target as Node)) {
        setShowCopyButton(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showCopyButton]);

  // Handle drawing on canvas when text layer is disabled
  useEffect(() => {
    if (textLayerEnabled || !drawingCanvasRef.current) return;

    const drawingCanvas = drawingCanvasRef.current;
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;

    // Set up drawing styles
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const startDrawing = (e: MouseEvent) => {
      // Get canvas-relative coordinates
      const rect = drawingCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      setIsDrawing(true);
      setLastPosition({ x, y });
      
      // Start a new path
      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: MouseEvent) => {
      if (!isDrawing) return;
      
      // Get canvas-relative coordinates
      const rect = drawingCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Draw line from last position to current position
      ctx.beginPath();
      ctx.moveTo(lastPosition.x, lastPosition.y);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // Update last position
      setLastPosition({ x, y });
    };

    const stopDrawing = () => {
      setIsDrawing(false);
    };

    // Add event listeners
    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', stopDrawing);
    drawingCanvas.addEventListener('mouseleave', stopDrawing);

    // Clean up
    return () => {
      drawingCanvas.removeEventListener('mousedown', startDrawing);
      drawingCanvas.removeEventListener('mousemove', draw);
      drawingCanvas.removeEventListener('mouseup', stopDrawing);
      drawingCanvas.removeEventListener('mouseleave', stopDrawing);
    };
  }, [textLayerEnabled, isDrawing, lastPosition, drawingColor, drawingLineWidth]);

  // Clear drawing canvas
  const clearDrawing = () => {
    if (!drawingCanvasRef.current) return;
    
    const drawingCanvas = drawingCanvasRef.current;
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;
    
    ctx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
  };

  // Update ref when renderProgress changes
  useEffect(() => {
    renderProgressRef.current = renderProgress;
  }, [renderProgress]);

  useEffect(() => {
    let isMounted = true;
    let renderTask: ReturnType<typeof page.render> | null = null;
    
    const renderPage = async () => {
      // Skip rendering if the page isn't visible
      if (!canvasRef.current || !shouldRender) return;
      
      // If already rendered once, don't re-render
      if (hasRendered) return;

      setIsRendering(true);
      setRenderProgress(0);

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;

      // Apply quality multiplier to canvas dimensions for higher resolution rendering
      const outputScale = window.devicePixelRatio || 1;
      const totalScale = outputScale * quality;

      // Set display size
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      // Set actual size in memory (scaled to account for device pixel ratio and quality)
      canvas.width = Math.floor(viewport.width * totalScale);
      canvas.height = Math.floor(viewport.height * totalScale);

      // Get context and scale it
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.scale(totalScale, totalScale);

      // Set up drawing canvas if text layer is disabled
      if (!textLayerEnabled && drawingCanvasRef.current) {
        const drawingCanvas = drawingCanvasRef.current;
        
        // Set drawing canvas to same display size as content
        drawingCanvas.style.width = `${Math.floor(viewport.width)}px`;
        drawingCanvas.style.height = `${Math.floor(viewport.height)}px`;
        
        // Set actual size in memory (1:1 with display size for accurate drawing)
        drawingCanvas.width = Math.floor(viewport.width);
        drawingCanvas.height = Math.floor(viewport.height);
      }

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      try {
        // Create a custom render progress tracker
        const progressTracker = {
          onProgress: (progress: { loaded: number; total: number }) => {
            if (!isMounted) return;
            if (progress.total > 0) {
              const percentage = Math.round((progress.loaded / progress.total) * 100);
              setRenderProgress(percentage);
            }
          },
        };

        // Render the page content on canvas
        renderTask = page.render({
          ...renderContext,
          ...progressTracker,
        });

        // Set up progress monitoring
        renderTask.onContinue = (cont: () => void) => {
          // This ensures the progress is updated during rendering
          if (!isMounted) return false;
          if (renderProgressRef.current < 90) {
            // Increment progress to show activity
            setRenderProgress(prev => Math.min(prev + 5, 90));
          }
          cont();
          return true;
        };

        // Get the text content of the page if text layer is enabled
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
          textLayerDiv.style.transformOrigin = '0 0';

          let textLayerRendered = false;

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

              // Safety check for textContent
              if (!textContent || !Array.isArray(textContent.items) || textContent.items.length === 0) {
                console.warn('Text content is empty or invalid:', textContent);
                throw new Error('Invalid text content');
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
                  // Skip marked content items, which have types like 'beginMarkedContentProps'
                  if (item.type?.startsWith('beginMarkedContent')) {
                    return false;
                  }
                  
                  // Skip items without string content
                  if (!item.str) {
                    return false;
                  }
                  
                  // Skip items without transform data
                  if (!item.transform || item.transform.length < 6) {
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
                    }

                    // Set positioning styles
                    textDiv.style.position = 'absolute';
                    textDiv.style.left = `${tx[4]}px`;
                    textDiv.style.top = `${tx[5] - fontHeight}px`;
                    textDiv.style.fontSize = `${fontHeight}px`;
                    textDiv.style.fontFamily = 'sans-serif';

                    // Apply rotation if needed
                    if (angle !== 0) {
                      textDiv.style.transform = `rotate(${angle}rad)`;
                      textDiv.style.transformOrigin = 'left bottom';
                    }

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
                }).filter(item => item !== null);

              if (!isMounted) return;
              
              // Create a document fragment for better performance
              const fragment = document.createDocumentFragment();
              
              // Use for...of instead of forEach
              for (const item of textItems) {
                if (item) fragment.appendChild(item);
              }

              // Append all text items to the text layer at once
              if (textLayerDiv && isMounted) {
                textLayerDiv.appendChild(fragment);
                textLayerRendered = true;
              }
            } catch (_textError) {
              throw new Error('Failed to render text layer');
            }
          } catch (_error) {
            // Add a fallback message to the text layer
            if (textLayerRef.current && !textLayerRendered && isMounted) {
              const errorMessage = document.createElement('div');
              errorMessage.style.padding = '10px';
              errorMessage.style.color = '#f44336';
              errorMessage.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
              errorMessage.style.borderRadius = '4px';
              errorMessage.style.position = 'absolute';
              errorMessage.style.top = '50%';
              errorMessage.style.left = '50%';
              errorMessage.style.transform = 'translate(-50%, -50%)';
              errorMessage.textContent = 'Text layer could not be loaded';
              textLayerRef.current.appendChild(errorMessage);
            }
          }
        } else {
          await renderTask.promise;
        }
        
        // Set progress to 100% when rendering is complete
        if (isMounted) {
          setRenderProgress(100);
          setIsRendering(false);
          setHasRendered(true);
        }
      } catch (_error) {
        // Even on error, set progress to 100% to remove the loading indicator
        if (isMounted) {
          setRenderProgress(100);
          setIsRendering(false);
        }
      }
    };

    // Only render if the page should be rendered
    if (shouldRender) {
      renderPage();
    } else {
      // Reset rendering state when page becomes invisible
      setIsRendering(false);
    }

    // Cleanup function to cancel rendering when component unmounts or dependencies change
    return () => {
      isMounted = false;
      if (renderTask?.cancel) {
        renderTask.cancel();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scale, quality, textLayerEnabled, shouldRender, hasRendered]);

  // Reset hasRendered when scale or quality changes to force re-rendering
  useEffect(() => {
    if (scale !== prevScaleRef.current || quality !== prevQualityRef.current) {
      setHasRendered(false);
      prevScaleRef.current = scale;
      prevQualityRef.current = quality;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, quality]);

  // Return a placeholder if the page shouldn't be rendered
  if (!shouldRender && !hasRendered) {
    // Calculate dimensions to preserve layout
    const viewport = page.getViewport({ scale });
    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);
    
    return (
      <div 
        id={id} 
        className={styles.pageContainer} 
        ref={containerRef}
      >
        <div className={styles.pageInfo}>
          Page {pageNumber} ({Math.round(page.view[2])} × {Math.round(page.view[3])} px)
        </div>
        <div 
          className={styles.pageContent} 
          style={{ width: `${width}px`, height: `${height}px` }}
        >
          <div className={styles.placeholderPage}>
            Loading page {pageNumber}...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div id={id} className={styles.pageContainer} ref={containerRef}>
      <div className={styles.pageInfo}>
        Page {pageNumber} ({Math.round(page.view[2])} × {Math.round(page.view[3])} px)
        {quality > 1 && <span> - {quality}x quality</span>}
        {!textLayerEnabled && (
          <button 
            className={styles.clearButton} 
            onClick={clearDrawing}
            type="button">
            Clear Drawing
          </button>
        )}
      </div>
      <div className={styles.pageContent}>
        {/* Use a wrapper div to ensure perfect alignment between canvas and text layer */}
        <div className={styles.canvasWrapper}>
          {/* Render canvas first, so text layer appears on top in the DOM */}
          <canvas ref={canvasRef} className={styles.pageCanvas} />
          
          {textLayerEnabled && (
            <div
              ref={textLayerRef}
              className={`${styles.textLayer} ${hasSelection ? styles.hasSelection : ''}`}
              title='Text can be selected and copied'
              data-page-number={pageNumber} />
          )}
        </div>
        
        {!textLayerEnabled && (
          <canvas 
            ref={drawingCanvasRef} 
            className={styles.drawingLayer}
            title='Click and drag to draw'
          />
        )}

        {showCopyButton && (
          <button
            className={`${styles.copyButton} ${copySuccess ? styles.success : ''}`}
            style={{
              left: `${copyButtonPosition.x}px`,
              top: `${copyButtonPosition.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            onClick={handleCopy}
            type="button">
            {copySuccess ? 'Copied!' : 'Copy'}
          </button>
        )}
      </div>

      {isRendering && (
        <div className={styles.renderingOverlay}>
          <div>Rendering{renderProgress > 0 ? ` (${renderProgress}%)` : '...'}</div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${renderProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
};
