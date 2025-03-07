import { useEffect, useRef, useState } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import * as pdfjs from 'pdfjs-dist';
import classes from './TextLayer.module.scss';

interface TextLayerProps {
  page: PDFPageProxy;
  viewport: any;
  scale: number;
  rotation: number;
  renderTask: any;
  onSelectionChange?: (hasSelection: boolean) => void;
}

// Define a proper type for text content items
interface TextItem {
  str?: string;
  type?: string;
  transform?: number[];
  fontName?: string;
  [key: string]: unknown;
}

export const TextLayer = ({
  page,
  viewport,
  scale,
  rotation,
  renderTask,
  onSelectionChange,
}: TextLayerProps) => {
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [showCopyButton, setShowCopyButton] = useState(false);

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
        
        // Notify parent component about selection change
        if (onSelectionChange) {
          onSelectionChange(true);
        }

        // Add hasSelection class to keep text visible
        textLayer.classList.add(classes.hasSelection);
      } else {
        setHasSelection(false);
        
        // Notify parent component about selection change
        if (onSelectionChange) {
          onSelectionChange(false);
        }

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
            
            // Notify parent component about selection change
            if (onSelectionChange) {
              onSelectionChange(false);
            }

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
  }, [isSelecting, hasSelection, onSelectionChange]);

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

  // Render text layer content
  useEffect(() => {
    let isMounted = true;

    const renderTextLayer = async () => {
      if (!textLayerRef.current || !viewport || !renderTask) {
        return;
      }

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
      
      // Apply any necessary transforms based on rotation
      if (rotation !== 0) {
        // For rotated pages, ensure the text layer rotates with the canvas
        textLayerDiv.style.transform = `rotate(${rotation}deg)`;
        textLayerDiv.style.transformOrigin = 'top left';
      } else {
        // Remove any transform or transformOrigin from the container
        textLayerDiv.style.transform = '';
        textLayerDiv.style.transformOrigin = '';
      }

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
                // Adjust the top position to align text properly with the canvas
                // The fontHeight adjustment is critical for proper vertical alignment
                const top = tx[5] - fontHeight;

                // Apply precise positioning with subpixel accuracy
                textDiv.style.left = `${left.toFixed(3)}px`;
                textDiv.style.top = `${top.toFixed(3)}px`;
                textDiv.style.fontSize = `${fontHeight.toFixed(3)}px`;
                textDiv.style.fontFamily = 'sans-serif';
                textDiv.style.lineHeight = '1.0'; // Ensure consistent line height
                
                // Add a subtle border to make text selectable even with transparent background
                textDiv.style.border = '1px solid transparent';
                
                // Allow normal text selection (removing user-select: all)
                // This enables selecting text by dragging the mouse
                textDiv.style.userSelect = 'text';
                
                // Calculate text width based on transform matrix
                // This helps ensure the text block width matches the actual text on the page
                // The width calculation is based on the font metrics in the transform matrix
                let textWidth: number;
                if (item.width && typeof item.width === 'number') {
                  // If the item has a width property, use it directly
                  textWidth = item.width * viewport.scale;
                } else {
                  // Otherwise calculate based on transform and string length
                  // Apply a dynamic scaling factor based on font size
                  // Larger fonts need more width adjustment
                  let scaleFactor: number;
                  
                  // Progressive scaling based on font size
                  if (fontHeight > 24) {
                    scaleFactor = 1.15; // Very large fonts
                  } else if (fontHeight > 20) {
                    scaleFactor = 1.12; // Large fonts
                  } else if (fontHeight > 16) {
                    scaleFactor = 1.08; // Medium-large fonts
                  } else if (fontHeight > 12) {
                    scaleFactor = 1.05; // Medium fonts
                  } else if (fontHeight > 9) {
                    scaleFactor = 0.95; // Small-medium fonts
                  } else {
                    scaleFactor = 0.9; // Small fonts
                  }
                  
                  // Calculate width based on character width and apply scaling
                  const charWidth = Math.abs(tx[0]) / (item.str?.length || 1);
                  textWidth = charWidth * (item.str?.length || 1) * fontHeight * scaleFactor;
                  
                  // Additional adjustment for specific characters
                  // Some characters like 'W', 'M' need more width
                  if (item.str && /[WMwm]/.test(item.str)) {
                    textWidth *= 1.05; // Add 5% for wide characters
                  }
                }
                
                // Ensure minimum width for very short text
                textWidth = Math.max(textWidth, fontHeight * 0.5);
                
                // Apply the calculated width with a slight buffer
                textDiv.style.width = `${(textWidth + 1).toFixed(3)}px`;
                
                // Adjust letter spacing based on font size
                // Larger fonts need less letter spacing adjustment
                let letterSpacing: string;
                if (fontHeight > 20) {
                  letterSpacing = '0.01em'; // Slight positive spacing for very large fonts
                } else if (fontHeight > 14) {
                  letterSpacing = '0em'; // No adjustment for large fonts
                } else {
                  letterSpacing = '-0.01em'; // Slight negative spacing for smaller fonts
                }
                textDiv.style.letterSpacing = letterSpacing;
                
                // Prevent text from being cut off
                textDiv.style.overflow = 'visible';

                // Apply rotation if needed
                if (angle !== 0) {
                  textDiv.style.transform = `rotate(${angle}rad)`;
                  textDiv.style.transformOrigin = 'left bottom';
                }

                // Ensure text doesn't wrap
                textDiv.style.whiteSpace = 'pre';
                
                // Prevent text from being scaled incorrectly
                textDiv.style.textRendering = 'geometricPrecision';

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

                  // Position it based on the transform with improved precision
                  const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
                  textDiv.style.left = `${tx[4].toFixed(3)}px`;
                  textDiv.style.top = `${(tx[5] - fontHeight).toFixed(3)}px`;
                  textDiv.style.fontSize = `${fontHeight.toFixed(3)}px`;
                  textDiv.style.fontFamily = 'sans-serif';
                  textDiv.style.lineHeight = '1.0';
                  textDiv.style.textRendering = 'geometricPrecision';
                  
                  // Add a subtle border for selection with transparent background
                  textDiv.style.border = '1px solid transparent';
                  
                  // Allow normal text selection
                  textDiv.style.userSelect = 'text';
                  
                  // Calculate text width for fallback items
                  let textWidth: number;
                  if (item.width && typeof item.width === 'number') {
                    textWidth = item.width * viewport.scale;
                  } else {
                    // Apply dynamic scaling based on font size
                    let scaleFactor: number;
                    
                    // Progressive scaling based on font size
                    if (fontHeight > 24) {
                      scaleFactor = 1.15; // Very large fonts
                    } else if (fontHeight > 20) {
                      scaleFactor = 1.12; // Large fonts
                    } else if (fontHeight > 16) {
                      scaleFactor = 1.08; // Medium-large fonts
                    } else if (fontHeight > 12) {
                      scaleFactor = 1.05; // Medium fonts
                    } else if (fontHeight > 9) {
                      scaleFactor = 0.95; // Small-medium fonts
                    } else {
                      scaleFactor = 0.9; // Small fonts
                    }
                    
                    const charWidth = Math.abs(tx[0]) / (item.str?.length || 1);
                    textWidth = charWidth * (item.str?.length || 1) * fontHeight * scaleFactor;
                    
                    // Additional adjustment for specific characters
                    if (item.str && /[WMwm]/.test(item.str)) {
                      textWidth *= 1.05;
                    }
                  }
                  
                  textWidth = Math.max(textWidth, fontHeight * 0.5);
                  textDiv.style.width = `${(textWidth + 1).toFixed(3)}px`;
                  
                  // Adjust letter spacing based on font size
                  let letterSpacing: string;
                  if (fontHeight > 20) {
                    letterSpacing = '0.01em';
                  } else if (fontHeight > 14) {
                    letterSpacing = '0em';
                  } else {
                    letterSpacing = '-0.01em';
                  }
                  textDiv.style.letterSpacing = letterSpacing;
                  textDiv.style.overflow = 'visible';

                  return textDiv;
                } catch (_err) {
                  return null;
                }
              })
              .filter((item) => item !== null);

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
    };

    renderTextLayer();

    return () => {
      isMounted = false;
    };
  }, [page, viewport, scale, rotation, renderTask]);

  // Copy selected text
  const copySelectedText = () => {
    const selection = window.getSelection();
    if (selection?.toString().trim()) {
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
    <>
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

      {showCopyButton && (
        <button className={classes.copyButton} onClick={copySelectedText}>
          Copy
        </button>
      )}
    </>
  );
}; 