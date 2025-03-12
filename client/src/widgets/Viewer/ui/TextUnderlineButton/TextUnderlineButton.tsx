import React, { useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { Drawing } from '../../model/types/viewerSchema';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import styles from './TextUnderlineButton.module.scss';

interface TextUnderlineButtonProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  scale: number;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const TextUnderlineButton: React.FC<TextUnderlineButtonProps> = ({ pageNumber, onDrawingCreated, scale, pdfCanvasRef }) => {
  const { state } = useContext(ViewerContext);
  const { drawingColor, drawingLineWidth } = state;

  // Function to calculate line segments for multiple lines of text
  const getLineSegments = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];

    const lines: { start: { x: number; y: number }; end: { x: number; y: number } }[] = [];

    // Find all text spans that are part of the selection
    const getSelectedElements = () => {
      const elements: HTMLElement[] = [];
      
      // Find the current page container
      const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
      if (!pageContainer) return elements;
      
      // Look specifically for span elements that are likely to contain text
      // Limiting query to within the current page container
      pageContainer.querySelectorAll('span').forEach(node => {
        // Check if this node is part of the selection
        if (selection && selection.containsNode(node, true)) {
          // Only include nodes with actual text content
          if (node.textContent && node.textContent.trim() !== '') {
            elements.push(node as HTMLElement);
          }
        }
      });
      
      // Sort elements by their vertical position for proper line ordering
      elements.sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        
        // If the difference in y-coordinate is significant, sort by y
        if (Math.abs(rectA.top - rectB.top) > 5) {
          return rectA.top - rectB.top;
        } 
        // Within the same line, sort by x
        return rectA.left - rectB.left;
      });
      
      return elements;
    };
    
    // Get all spans that are part of the selection
    const selectedElements = getSelectedElements();
    
    // If no elements found, try using range.getClientRects as fallback
    if (selectedElements.length === 0) {
      for (let i = 0; i < selection.rangeCount; i++) {
        const range = selection.getRangeAt(i);
        const clientRects = range.getClientRects();
        
        for (let j = 0; j < clientRects.length; j++) {
          const rect = clientRects[j];
          // Skip very thin rects
          if (rect.height < 5) continue;
          
          // Find what page this rectangle is on
          const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
          if (!pageContainer) continue;
          
          const pageRect = pageContainer.getBoundingClientRect();
          
          // Calculate coordinates relative to the page
          const startX = (rect.left - pageRect.left) / scale;
          const endX = (rect.right - pageRect.left) / scale;
          const y = (rect.bottom - pageRect.top - 2) / scale;
          
          lines.push({
            start: { x: startX, y },
            end: { x: endX, y }
          });
        }
      }
    } else {
      // Group elements by line (based on y-coordinate)
      const lineGroups: HTMLElement[][] = [];
      let currentLine: HTMLElement[] = [];
      let lastY = -1;
      
      selectedElements.forEach(element => {
        const rect = element.getBoundingClientRect();
        
        // If this element is on a new line (y-coord differs significantly)
        if (lastY >= 0 && Math.abs(rect.top - lastY) > 5) {
          if (currentLine.length > 0) {
            lineGroups.push(currentLine);
            currentLine = [];
          }
        }
        
        currentLine.push(element);
        lastY = rect.top;
      });
      
      // Add the last line if not empty
      if (currentLine.length > 0) {
        lineGroups.push(currentLine);
      }
      
      // Find the page container
      const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
      if (!pageContainer) return lines;
      
      const pageRect = pageContainer.getBoundingClientRect();
      
      // Process each line group to create a single underline per line
      lineGroups.forEach(lineElements => {
        if (lineElements.length === 0) return;
        
        // Sort elements in the line by x-coordinate
        lineElements.sort((a, b) => {
          return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
        });
        
        // Get leftmost and rightmost elements
        const firstElement = lineElements[0];
        const lastElement = lineElements[lineElements.length - 1];
        
        const firstRect = firstElement.getBoundingClientRect();
        const lastRect = lastElement.getBoundingClientRect();
        
        // Create a single line segment for the entire line
        const startX = (firstRect.left - pageRect.left) / scale;
        const endX = (lastRect.right - pageRect.left) / scale;
        const y = (firstRect.bottom - pageRect.top - 2) / scale; // Position slightly below text
        
        lines.push({
          start: { x: startX, y },
          end: { x: endX, y }
        });
      });
    }
    
    return lines;
  };

  // Create text underline drawing
  const createTextUnderline = () => {
    const lineSegments = getLineSegments();

    if (lineSegments.length === 0) return;

    // Get the selected text
    const selectedText = window.getSelection()?.toString() || '';

    // Capture the image of the underlined area if we have the pdfCanvasRef
    let image = '';
    if (pdfCanvasRef?.current) {
      // Calculate the bounding box for the underlined area
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      // Find the extremes of all line segments to create a bounding box
      lineSegments.forEach(segment => {
        minX = Math.min(minX, segment.start.x, segment.end.x);
        minY = Math.min(minY, segment.start.y, segment.end.y);
        maxX = Math.max(maxX, segment.start.x, segment.end.x);
        maxY = Math.max(maxY, segment.start.y, segment.end.y);
      });

      // Find the page container to help with coordinate translation
      const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
      if (pageContainer) {
        // Get the selection and analyze selected text elements to find accurate height
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          // Find all selected elements within this page
          const selectedElements: HTMLElement[] = [];
          pageContainer.querySelectorAll('span').forEach(node => {
            if (selection.containsNode(node, true)) {
              if (node.textContent && node.textContent.trim() !== '') {
                selectedElements.push(node as HTMLElement);
              }
            }
          });
          
          // If we found selected elements, use them to calculate a more accurate bounding box
          if (selectedElements.length > 0) {
            const pageRect = pageContainer.getBoundingClientRect();
            
            // Reset min/max values
            minX = Infinity;
            minY = Infinity;
            maxX = -Infinity;
            maxY = -Infinity;
            
            // Find the extremes of all selected elements
            selectedElements.forEach(element => {
              const rect = element.getBoundingClientRect();
              // Convert to page-relative coordinates and to scale-normalized coordinates
              const left = (rect.left - pageRect.left) / scale;
              const top = (rect.top - pageRect.top) / scale;
              const right = (rect.right - pageRect.left) / scale;
              const bottom = (rect.bottom - pageRect.top) / scale;
              
              minX = Math.min(minX, left);
              minY = Math.min(minY, top);
              maxX = Math.max(maxX, right);
              maxY = Math.max(maxY, bottom);
            });
          }
        }
        
        // Calculate the font height (distance from top to bottom)
        const fontHeight = maxY - minY;
        
        // Add generous padding - more for larger fonts
        let topPadding = Math.max(10, fontHeight * 0.2); // 50% of font height or at least 10px
        let sidePadding = Math.max(10, fontHeight * 0.2); // 20% of font height or at least 10px
        let bottomPadding = Math.max(10, fontHeight * 0.2); // 20% of font height or at least 10px
        
        // Scale the coordinates back to screen coordinates for the bounding box
        const boundingBox = {
          left: (minX * scale) - sidePadding,
          top: (minY * scale) - topPadding, // Use minY (top of text) with padding
          width: ((maxX - minX) * scale) + (sidePadding * 2),
          height: ((maxY - minY) * scale) + topPadding + bottomPadding
        };

        // Capture the image
        image = captureDrawingImage(
          pdfCanvasRef.current,
          null, // No drawing canvas for text underline
          boundingBox,
          false // Don't capture drawing layer
        );
      }
    }

    // Create the underline drawing
    const underlineDrawing: Drawing = {
      type: 'textUnderline',
      color: drawingColor,
      pageNumber,
      lineWidth: drawingLineWidth / scale,
      lines: lineSegments,
      text: selectedText,
      image // Add the captured image
    };

    // Pass the drawing to the parent component
    onDrawingCreated(underlineDrawing);
  };

  return (
    <button className={styles.textUnderlineButton} onClick={createTextUnderline} title='Underline text'>
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
      Underline
    </button>
  );
};

export default TextUnderlineButton;
