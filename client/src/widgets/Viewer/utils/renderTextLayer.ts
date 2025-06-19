import * as pdfjs from 'pdfjs-dist';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';

// Define a proper type for text content items
interface TextItem {
  str?: string;
  type?: string;
  transform?: number[];
  fontName?: string;
  width?: number;
  [key: string]: unknown;
}

/**
 * Renders the text layer for a PDF page
 */
export const renderTextLayer = async (textLayerRef: HTMLDivElement, page: PDFPageProxy, viewport: any): Promise<void> => {
  // Clear previous text layer content
  textLayerRef.innerHTML = '';

  try {
    try {
      // Get text content
      const textContent = await page.getTextContent({
        includeMarkedContent: true,
      });

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
              switch (true) {
                case fontHeight > 60:
                  scaleFactor = 1.35; // Very large fonts
                  break;
                case fontHeight > 40:
                  scaleFactor = 1.25; // Reduced from 1.4 for 40-60px range
                  break;
                case fontHeight > 24:
                  scaleFactor = 1.2; // Reduced from 1.35
                  break;
                case fontHeight > 20:
                  scaleFactor = 1.15; // Reduced from 1.3
                  break;
                case fontHeight > 16:
                  scaleFactor = 1.12; // Reduced from 1.25
                  break;
                case fontHeight > 12:
                  scaleFactor = 1.1; // Reduced from 1.2
                  break;
                case fontHeight > 9:
                  scaleFactor = 1.05; // Reduced from 1.15
                  break;
                default:
                  scaleFactor = 1.02; // Reduced from 1.1
                  break;
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
        .filter((item): item is HTMLElement => item !== null);

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
                switch (true) {
                  case fontHeight > 60:
                    scaleFactor = 1.35; // Very large fonts
                    break;
                  case fontHeight > 40:
                    scaleFactor = 1.25; // Reduced from 1.4 for 40-60px range
                    break;
                  case fontHeight > 24:
                    scaleFactor = 1.2; // Reduced from 1.35
                    break;
                  case fontHeight > 20:
                    scaleFactor = 1.15; // Reduced from 1.3
                    break;
                  case fontHeight > 16:
                    scaleFactor = 1.12; // Reduced from 1.25
                    break;
                  case fontHeight > 12:
                    scaleFactor = 1.1; // Reduced from 1.2
                    break;
                  case fontHeight > 9:
                    scaleFactor = 1.05; // Reduced from 1.15
                    break;
                  default:
                    scaleFactor = 1.02; // Reduced from 1.1
                    break;
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
          .filter((item): item is HTMLElement => item !== null);

        // Use the fallback items instead
        if (fallbackItems.length > 0) {
          // Create a document fragment for better performance
          const fragment = document.createDocumentFragment();

          // Append all fallback items
          for (const item of fallbackItems) {
            if (item) fragment.appendChild(item);
          }

          // Append to the text layer
          textLayerRef.appendChild(fragment);
        }
      } else {
        // Create a document fragment for better performance
        const fragment = document.createDocumentFragment();

        // Use for...of instead of forEach
        for (const item of textItems) {
          if (item) fragment.appendChild(item);
        }

        // Append all text items to the text layer at once
        textLayerRef.appendChild(fragment);
      }
    } catch (_textError) {
      throw new Error('Failed to render text layer');
    }
  } catch (_error) {
    // Add a fallback message to the text layer
    const errorMessage = document.createElement('div');
    errorMessage.textContent = 'Failed to render text layer';
    textLayerRef.appendChild(errorMessage);
  }
};
