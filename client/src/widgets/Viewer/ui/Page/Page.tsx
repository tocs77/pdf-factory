import { useEffect, useRef, useState } from 'react';
import { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
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
}

export const Page = ({ page, scale, pageNumber, id, quality = 1, textLayerEnabled = true }: PageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderProgress, setRenderProgress] = useState(0);
  const [selectedText, setSelectedText] = useState('');
  const [showCopyButton, setShowCopyButton] = useState(false);
  const [copyButtonPosition, setCopyButtonPosition] = useState({ x: 0, y: 0 });
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  // Handle text selection
  useEffect(() => {
    if (!textLayerEnabled) {
      setShowCopyButton(false);
      setHasSelection(false);
      return;
    }

    const handleSelectionStart = (e: MouseEvent) => {
      if (textLayerRef.current?.contains(e.target as Node)) {
        setIsSelecting(true);
        if (textLayerRef.current) {
          textLayerRef.current.classList.add(styles.selecting);
        }
      }
    };

    const handleSelectionEnd = () => {
      setIsSelecting(false);
      
      // Remove selecting class
      if (textLayerRef.current) {
        textLayerRef.current.classList.remove(styles.selecting);
      }
      
      const selection = window.getSelection();
      if (!selection) return;
      
      // Check if selection is within our text layer or if we were in selection mode
      let isInTextLayer = false;
      if (textLayerRef.current) {
        if (selection.anchorNode && textLayerRef.current.contains(selection.anchorNode)) {
          isInTextLayer = true;
        }
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
          if (textLayerRef.current) {
            textLayerRef.current.classList.add(styles.hasSelection);
          }
        } else {
          setShowCopyButton(false);
          setHasSelection(false);
          
          // Remove hasSelection class when no text is selected
          if (textLayerRef.current) {
            textLayerRef.current.classList.remove(styles.hasSelection);
          }
        }
      }
    };

    // Track selection changes
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
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

  useEffect(() => {
    const renderPage = async () => {
      if (!canvasRef.current) return;

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

      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };

      try {
        // Create a custom render progress tracker
        const progressTracker = {
          onRenderProgress: (progress: { loaded?: number; total?: number }) => {
            if (progress.total && progress.loaded !== undefined) {
              const percentage = Math.round((progress.loaded / progress.total) * 100);
              setRenderProgress(percentage);
            }
          },
        };

        // Render the page content on canvas
        const renderTask = page.render({
          ...renderContext,
          ...progressTracker,
        });

        // Get the text content of the page if text layer is enabled
        if (textLayerEnabled && textLayerRef.current) {
          const textLayerDiv = textLayerRef.current;

          // Clear previous text layer content
          textLayerDiv.innerHTML = '';

          // Ensure text layer has the exact same dimensions as the canvas
          textLayerDiv.style.width = `${Math.floor(viewport.width)}px`;
          textLayerDiv.style.height = `${Math.floor(viewport.height)}px`;

          try {
            // Get text content
            const textContent = await page.getTextContent();

            // Wait for canvas rendering to complete
            await renderTask;

            // Create text layer items with proper positioning
            const textItems = textContent.items.map((item: any) => {
              // Transform coordinates
              const tx = pdfjs.Util.transform(viewport.transform, item.transform);

              // Calculate font height and rotation angle
              const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
              const angle = Math.atan2(tx[1], tx[0]);

              // Create text span element
              const textDiv = document.createElement('span');
              textDiv.textContent = item.str;

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
              textDiv.dataset.fontName = item.fontName;

              // Add event listeners to improve selection behavior
              textDiv.addEventListener('mousedown', (e) => {
                // Prevent default to avoid issues with text selection
                e.stopPropagation();
              });

              return textDiv;
            });

            // Create a document fragment for better performance
            const fragment = document.createDocumentFragment();
            textItems.forEach((item) => fragment.appendChild(item));

            // Append all text items to the text layer at once
            textLayerDiv.appendChild(fragment);
          } catch (error) {
            console.error('Error rendering text layer:', error);
          }
        } else {
          await renderTask;
        }
      } catch (error) {
        console.error('Error rendering PDF page:', error);
      } finally {
        setRenderProgress(100);
        setIsRendering(false);
      }
    };

    renderPage();
  }, [page, scale, quality, textLayerEnabled]);

  return (
    <div id={id} className={styles.pageContainer}>
      <div className={styles.pageInfo}>
        Page {pageNumber} ({Math.round(page.view[2])} × {Math.round(page.view[3])} px)
        {quality > 1 && <span> - {quality}x quality</span>}
      </div>
      <div className={styles.pageContent}>
        {textLayerEnabled && (
          <div
            ref={textLayerRef}
            className={`${styles.textLayer} ${hasSelection ? styles.hasSelection : ''}`}
            title='Text can be selected and copied'
            data-page-number={pageNumber}></div>
        )}
        <canvas ref={canvasRef} />

        {showCopyButton && (
          <div
            className={`${styles.copyButton} ${copySuccess ? styles.success : ''}`}
            style={{
              left: `${copyButtonPosition.x}px`,
              top: `${copyButtonPosition.y}px`,
              transform: 'translate(-50%, -100%)',
            }}
            onClick={handleCopy}>
            {copySuccess ? 'Copied!' : 'Copy'}
          </div>
        )}
      </div>

      {isRendering && (
        <div className={styles.renderingOverlay}>
          <div>Rendering...</div>
          <div className={styles.progressText}>{renderProgress}%</div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${renderProgress}%` }}></div>
          </div>
        </div>
      )}
    </div>
  );
};
