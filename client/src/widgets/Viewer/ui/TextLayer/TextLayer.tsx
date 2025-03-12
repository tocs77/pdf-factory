import { useEffect, useRef, useState, MouseEvent as ReactMouseEvent } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import * as pdfjs from 'pdfjs-dist';
import classes from './TextLayer.module.scss';
import TextUnderlineButton from '../TextUnderlineButton/TextUnderlineButton';
import buttonStyles from '../TextUnderlineButton/TextUnderlineButton.module.scss';
import { Drawing } from '../../model/types/viewerSchema';

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
  pageNumber,
  onDrawingCreated,
  pdfCanvasRef,
}: TextLayerProps) => {
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [showCopyButton, setShowCopyButton] = useState(false);

  // State to track toolbar position
  const [toolbarPosition, setToolbarPosition] = useState({ top: 60, left: 10 });
  // State for dragging functionality
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

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
      const isClickingTextButton = !!(e.target as HTMLElement).closest(`.${buttonStyles.textUnderlineButton}`);
      const isClickingCopyButton = !!(e.target as HTMLElement).closest(`.${classes.copyButton}`);
      
      if (
        hasSelection &&
        textLayerRef.current &&
        !textLayerRef.current.contains(e.target as Node) &&
        !isClickingToolbar &&
        !isClickingTextButton &&
        !isClickingCopyButton
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
      const isClickingTextButton = !!(e.target as HTMLElement).closest(`.${buttonStyles.textUnderlineButton}`);
      const isClickingCopyButton = !!(e.target as HTMLElement).closest(`.${classes.copyButton}`);
      
      if (
        showCopyButton &&
        !isClickingToolbar &&
        !isClickingTextButton &&
        !isClickingCopyButton &&
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
    let isMounted = true;

    const renderTextLayer = async () => {
      if (!textLayerRef.current || !viewport || !renderTask) {
        return;
      }

      const textLayerDiv = textLayerRef.current;

      // Clear previous text layer content
      textLayerDiv.innerHTML = '';

      // Ensure text layer has the exact same dimensions as the canvas
      // Note: We don't need to set dimensions here as they're handled by the rotation-specific useEffect
      
      // Ensure text layer is positioned exactly over the canvas
      // Note: We don't need to set position here as it's handled by the rotation-specific useEffect

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
                let left = tx[4];
                // Adjust the top position to align text properly with the canvas
                // The fontHeight adjustment is critical for proper vertical alignment
                let top = tx[5] - fontHeight;

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
                textDiv.style.cursor = 'text';
                
                // Add padding to improve selection area without affecting layout
                const paddingRight = fontHeight > 60 ? '6px' : fontHeight > 40 ? '4px' : fontHeight > 24 ? '3px' : '2px';
                const paddingLeft = fontHeight > 60 ? '2px' : fontHeight > 40 ? '1px' : fontHeight > 24 ? '1px' : '0px';
                
                textDiv.style.paddingRight = paddingRight;
                textDiv.style.paddingLeft = paddingLeft;
                textDiv.style.boxSizing = 'content-box';
                
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
                  if (fontHeight > 60) {
                    scaleFactor = 1.35; // Very large fonts
                  } else if (fontHeight > 40) {
                    scaleFactor = 1.25; // Reduced from 1.4 for 40-60px range
                  } else if (fontHeight > 24) {
                    scaleFactor = 1.2; // Reduced from 1.35
                  } else if (fontHeight > 20) {
                    scaleFactor = 1.15; // Reduced from 1.3
                  } else if (fontHeight > 16) {
                    scaleFactor = 1.12; // Reduced from 1.25
                  } else if (fontHeight > 12) {
                    scaleFactor = 1.1; // Reduced from 1.2
                  } else if (fontHeight > 9) {
                    scaleFactor = 1.05; // Reduced from 1.15
                  } else {
                    scaleFactor = 1.02; // Reduced from 1.1
                  }
                  
                  // Calculate width based on character width and apply scaling
                  const charWidth = Math.abs(tx[0]) / (item.str?.length || 1);
                  
                  // Add extra width to compensate for letter-spacing and ensure proper selection
                  let letterSpacingCompensation: number;
                  
                  // Adjust compensation based on font size
                  if (fontHeight > 60) {
                    letterSpacingCompensation = 1.25; // Reduced from 1.35
                  } else if (fontHeight > 40) {
                    letterSpacingCompensation = 1.15; // Reduced from 1.35
                  } else if (fontHeight > 24) {
                    letterSpacingCompensation = 1.1; // Reduced from 1.25
                  } else {
                    letterSpacingCompensation = 1.05; // Reduced from 1.15
                  }
                  
                  textWidth = charWidth * (item.str?.length || 1) * fontHeight * scaleFactor * letterSpacingCompensation;
                  
                  // Additional adjustment for specific characters
                  if (item.str && /[WMwm]/.test(item.str)) {
                    // Scale wide character adjustment based on font size
                    if (fontHeight > 60) {
                      textWidth *= 1.2; // 20% wider for very large fonts
                    } else if (fontHeight > 40) {
                      textWidth *= 1.15; // 15% wider for large fonts
                    } else {
                      textWidth *= 1.1; // 10% wider for normal fonts
                    }
                  }
                  
                  // Additional adjustment for text containing spaces
                  if (item.str && item.str.includes(' ')) {
                    // Scale space adjustment based on font size
                    if (fontHeight > 60) {
                      textWidth *= 1.15; // 15% wider for very large fonts with spaces
                    } else if (fontHeight > 40) {
                      textWidth *= 1.1; // 10% wider for large fonts with spaces
                    } else {
                      textWidth *= 1.05; // 5% wider for normal fonts with spaces
                    }
                  }
                  
                  // Extra adjustment for uppercase text which tends to be wider
                  if (item.str && /[A-Z]/.test(item.str)) {
                    if (fontHeight > 60) {
                      textWidth *= 1.1; // 10% wider for very large uppercase
                    } else if (fontHeight > 40) {
                      textWidth *= 1.08; // 8% wider for large uppercase
                    } else {
                      textWidth *= 1.05; // 5% wider for normal uppercase
                    }
                  }
                }
                
                // Ensure minimum width for very short text
                textWidth = Math.max(textWidth, fontHeight * 0.5);
                
                // Apply the calculated width with a slightly larger buffer
                // Add extra buffer for larger fonts - reduced for 40px range
                const buffer = fontHeight > 60 ? 4 : fontHeight > 40 ? 2 : fontHeight > 24 ? 2 : 1;
                textDiv.style.width = `${(textWidth + buffer).toFixed(3)}px`;
                
                // Adjust letter spacing based on font size
                // Larger fonts need more letter spacing adjustment for selection
                let letterSpacing: string;
                if (fontHeight > 60) {
                  letterSpacing = '0.15em'; // Special handling for very large fonts (like 72px)
                } else if (fontHeight > 40) {
                  letterSpacing = '0.08em'; // Reduced from 0.15em for 40-60px range
                } else if (fontHeight > 24) {
                  letterSpacing = '0.06em'; // Reduced from 0.1em
                } else if (fontHeight > 20) {
                  letterSpacing = '0.05em'; // Reduced from 0.08em
                } else if (fontHeight > 14) {
                  letterSpacing = '0.04em'; // Reduced from 0.05em
                } else {
                  letterSpacing = '0.02em'; // Keep as is for smaller fonts
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

                // Improve text selection behavior using non-standard CSS properties
                (textDiv.style as any)['boxDecorationBreak'] = 'clone';
                (textDiv.style as any)['-webkit-box-decoration-break'] = 'clone';

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
                  textDiv.style.cursor = 'text';
                  
                  // Add padding to improve selection area without affecting layout
                  const paddingRight = fontHeight > 60 ? '6px' : fontHeight > 40 ? '4px' : fontHeight > 24 ? '3px' : '2px';
                  const paddingLeft = fontHeight > 60 ? '2px' : fontHeight > 40 ? '1px' : fontHeight > 24 ? '1px' : '0px';
                  
                  textDiv.style.paddingRight = paddingRight;
                  textDiv.style.paddingLeft = paddingLeft;
                  textDiv.style.boxSizing = 'content-box';
                  
                  // Calculate text width for fallback items
                  let textWidth: number;
                  if (item.width && typeof item.width === 'number') {
                    textWidth = item.width * viewport.scale;
                  } else {
                    // Apply dynamic scaling based on font size
                    let scaleFactor: number;
                    
                    // Progressive scaling based on font size
                    if (fontHeight > 60) {
                      scaleFactor = 1.35; // Very large fonts
                    } else if (fontHeight > 40) {
                      scaleFactor = 1.25; // Reduced from 1.4 for 40-60px range
                    } else if (fontHeight > 24) {
                      scaleFactor = 1.2; // Reduced from 1.35
                    } else if (fontHeight > 20) {
                      scaleFactor = 1.15; // Reduced from 1.3
                    } else if (fontHeight > 16) {
                      scaleFactor = 1.12; // Reduced from 1.25
                    } else if (fontHeight > 12) {
                      scaleFactor = 1.1; // Reduced from 1.2
                    } else if (fontHeight > 9) {
                      scaleFactor = 1.05; // Reduced from 1.15
                    } else {
                      scaleFactor = 1.02; // Reduced from 1.1
                    }
                    
                    const charWidth = Math.abs(tx[0]) / (item.str?.length || 1);
                    
                    // Add extra width to compensate for letter-spacing in fallback items too
                    let letterSpacingCompensation: number;
                    
                    // Adjust compensation based on font size
                    if (fontHeight > 60) {
                      letterSpacingCompensation = 1.25; // Reduced from 1.35
                    } else if (fontHeight > 40) {
                      letterSpacingCompensation = 1.15; // Reduced from 1.35
                    } else if (fontHeight > 24) {
                      letterSpacingCompensation = 1.1; // Reduced from 1.25
                    } else {
                      letterSpacingCompensation = 1.05; // Reduced from 1.15
                    }
                    
                    textWidth = charWidth * (item.str?.length || 1) * fontHeight * scaleFactor * letterSpacingCompensation;
                    
                    // Additional adjustment for specific characters
                    if (item.str && /[WMwm]/.test(item.str)) {
                      // Scale wide character adjustment based on font size
                      if (fontHeight > 60) {
                        textWidth *= 1.2; // 20% wider for very large fonts
                      } else if (fontHeight > 40) {
                        textWidth *= 1.15; // 15% wider for large fonts
                      } else {
                        textWidth *= 1.1; // 10% wider for normal fonts
                      }
                    }
                    
                    // Additional adjustment for text containing spaces
                    if (item.str && item.str.includes(' ')) {
                      // Scale space adjustment based on font size
                      if (fontHeight > 60) {
                        textWidth *= 1.15; // 15% wider for very large fonts with spaces
                      } else if (fontHeight > 40) {
                        textWidth *= 1.1; // 10% wider for large fonts with spaces
                      } else {
                        textWidth *= 1.05; // 5% wider for normal fonts with spaces
                      }
                    }
                    
                    // Extra adjustment for uppercase text which tends to be wider
                    if (item.str && /[A-Z]/.test(item.str)) {
                      if (fontHeight > 60) {
                        textWidth *= 1.1; // 10% wider for very large uppercase
                      } else if (fontHeight > 40) {
                        textWidth *= 1.08; // 8% wider for large uppercase
                      } else {
                        textWidth *= 1.05; // 5% wider for normal uppercase
                      }
                    }
                  }
                  
                  textWidth = Math.max(textWidth, fontHeight * 0.5);
                  // Add extra buffer for larger fonts - reduced for 40px range
                  const buffer = fontHeight > 60 ? 4 : fontHeight > 40 ? 2 : fontHeight > 24 ? 2 : 1;
                  textDiv.style.width = `${(textWidth + buffer).toFixed(3)}px`;
                  
                  // Improve text selection behavior
                  (textDiv.style as any)['boxDecorationBreak'] = 'clone';
                  (textDiv.style as any)['-webkit-box-decoration-break'] = 'clone';
                  
                  // Adjust letter spacing based on font size
                  let letterSpacing: string;
                  if (fontHeight > 60) {
                    letterSpacing = '0.15em'; // Special handling for very large fonts (like 72px)
                  } else if (fontHeight > 40) {
                    letterSpacing = '0.08em'; // Reduced from 0.15em for 40-60px range
                  } else if (fontHeight > 24) {
                    letterSpacing = '0.06em'; // Reduced from 0.1em
                  } else if (fontHeight > 20) {
                    letterSpacing = '0.05em'; // Reduced from 0.08em
                  } else if (fontHeight > 14) {
                    letterSpacing = '0.04em'; // Reduced from 0.05em
                  } else {
                    letterSpacing = '0.02em'; // Keep as is for smaller fonts
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

  // Handler for starting drag operation
  const handleDragStart = (e: ReactMouseEvent) => {
    if (!toolbarRef.current) return;
    
    const rect = toolbarRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  // Handler for drag movement
  useEffect(() => {
    if (!isDragging) return;

    const handleDragMove = (e: MouseEvent) => {
      e.preventDefault();
      
      // Calculate new position based on mouse coordinates and drag offset
      const left = e.clientX - dragOffset.x;
      const top = e.clientY - dragOffset.y;
      
      // Get viewport dimensions
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Get toolbar dimensions
      let toolbarWidth = 150;
      let toolbarHeight = 80;
      if (toolbarRef.current) {
        const rect = toolbarRef.current.getBoundingClientRect();
        toolbarWidth = rect.width;
        toolbarHeight = rect.height;
      }
      
      // Ensure toolbar stays within viewport bounds
      const boundedLeft = Math.max(0, Math.min(left, viewportWidth - toolbarWidth));
      const boundedTop = Math.max(0, Math.min(top, viewportHeight - toolbarHeight));
      
      setToolbarPosition({ 
        left: boundedLeft, 
        top: boundedTop 
      });
    };

    const handleDragEnd = () => {
      setIsDragging(false);
    };

    // Add event listeners for dragging
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);

    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, dragOffset]);

  // Update toolbar position based on visible area
  useEffect(() => {
    // Only auto-position if not currently being dragged by the user
    if (!hasSelection || isDragging) return;

    const updatePosition = () => {
      // Get the page element containing this text layer
      const pageElement = textLayerRef.current?.closest('[data-page-number]');
      if (!pageElement) return;

      // Calculate page position relative to viewport
      const pageRect = pageElement.getBoundingClientRect();
      
      // Get the viewport width to ensure toolbar doesn't go off-screen to the right
      const viewportWidth = window.innerWidth;
      
      // Create a placeholder element to measure toolbar width (if needed)
      let toolbarWidth = 150; // Estimate for toolbar width
      const toolbarElement = document.querySelector(`.${classes.textSelectionToolbar}`);
      if (toolbarElement) {
        toolbarWidth = toolbarElement.getBoundingClientRect().width;
      }
      
      // Use a larger top offset to avoid overlapping with the viewer menu
      // 60px should be enough to clear most menu bars
      const topOffset = 60;
      
      // If page top is out of view (negative value), adjust toolbar position
      const top = Math.max(topOffset, -pageRect.top + topOffset); // offset from top of visible area
      
      // Calculate left position, ensuring it stays within viewport
      let left = Math.max(10, -pageRect.left + 10); // 10px from left of visible area
      
      // Ensure toolbar doesn't go off-screen to the right
      if (left + toolbarWidth > viewportWidth) {
        left = viewportWidth - toolbarWidth - 10; // 10px margin from right edge
      }

      setToolbarPosition({ top, left });
    };

    // Initial positioning
    updatePosition();

    // Update position on scroll and resize
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition, { passive: true });

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [hasSelection, isDragging]);

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
            
            // Force a selectionchange event to trigger the TextUnderlineButton
            const event = new Event('selectionchange', {
              bubbles: true,
              cancelable: true
            });
            document.dispatchEvent(event);
          }
        }}
      />
      
      {/* Text selection toolbar with both buttons */}
      {hasSelection && (
        <div 
          ref={toolbarRef}
          className={classes.textSelectionToolbar}
          style={{
            top: `${toolbarPosition.top}px`,
            left: `${toolbarPosition.left}px`,
            cursor: isDragging ? 'grabbing' : 'grab'
          }}
          onMouseDown={handleDragStart}
        >
          <div className={classes.toolbarHandle}>
            <div className={classes.dragHandle}></div>
          </div>
          {showCopyButton && (
            <button
              className={classes.copyButton}
              onClick={copySelectedText}
              title="Copy to clipboard">
              Copy
            </button>
          )}
          
          <TextUnderlineButton 
            pageNumber={pageNumber}
            onDrawingCreated={onDrawingCreated}
            scale={scale}
            pdfCanvasRef={pdfCanvasRef}
          />
        </div>
      )}
    </>
  );
}; 