import React, { useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { Drawing } from '../../model/types/viewerSchema';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import styles from './TextAreaTools.module.scss';

interface TextAreaToolsProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  scale: number;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const TextAreaTools: React.FC<TextAreaToolsProps> = ({ 
  pageNumber, 
  onDrawingCreated, 
  scale,
  pdfCanvasRef 
}) => {
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

  // Function to calculate rectangle segments for text highlighting
  const getHighlightRects = () => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];

    const rects: { x: number; y: number; width: number; height: number }[] = [];
    
    // Find all text spans that are part of the selection
    const getSelectedElements = () => {
      const elements: HTMLElement[] = [];
      
      // Find the current page container
      const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
      if (!pageContainer) return elements;
      
      // Look specifically for span elements that are likely to contain text
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
          const x = (rect.left - pageRect.left) / scale;
          const y = (rect.top - pageRect.top) / scale;
          const width = rect.width / scale;
          const height = rect.height / scale;
          
          rects.push({ x, y, width, height });
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
      if (!pageContainer) return rects;
      
      const pageRect = pageContainer.getBoundingClientRect();
      
      // Process each line group to create a single highlight rectangle per line
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
        
        // Find the top-most and bottom-most points in this line
        let minY = Infinity;
        let maxY = -Infinity;
        
        lineElements.forEach(el => {
          const elRect = el.getBoundingClientRect();
          minY = Math.min(minY, elRect.top);
          maxY = Math.max(maxY, elRect.bottom);
        });
        
        // Create a single rectangle for the entire line
        const x = (firstRect.left - pageRect.left) / scale;
        const y = (minY - pageRect.top) / scale;
        const width = (lastRect.right - firstRect.left) / scale;
        const height = (maxY - minY) / scale;
        
        rects.push({ x, y, width, height });
      });
    }
    
    return rects;
  };

  // Function to capture the image for any text annotation
  const captureTextAnnotationImage = () => {
    let image = '';
    if (!pdfCanvasRef?.current) return image;
    
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return image;
    
    // Find the page container
    const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pageContainer) return image;
    
    // Find all selected elements within this page
    const selectedElements: HTMLElement[] = [];
    pageContainer.querySelectorAll('span').forEach(node => {
      if (selection.containsNode(node, true)) {
        if (node.textContent && node.textContent.trim() !== '') {
          selectedElements.push(node as HTMLElement);
        }
      }
    });
    
    // If we found selected elements, calculate accurate bounding box
    if (selectedElements.length > 0) {
      const pageRect = pageContainer.getBoundingClientRect();
      
      // Calculate bounds
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      
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
      
      // Calculate the font height (distance from top to bottom)
      const fontHeight = maxY - minY;
      
      // Add generous padding - more for larger fonts
      let topPadding = Math.max(10, fontHeight * 0.2); // 20% of font height or at least 10px
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
        null, // No drawing canvas for text annotations
        boundingBox,
        false // Don't capture drawing layer
      );
    }
    
    return image;
  };

  // Create text underline drawing
  const createTextUnderline = () => {
    const lineSegments = getLineSegments();
    if (lineSegments.length === 0) return;

    // Get the selected text
    const selectedText = window.getSelection()?.toString() || '';
    
    // Capture image
    const image = captureTextAnnotationImage();

    // Create the underline drawing
    const underlineDrawing: Drawing = {
      type: 'textUnderline',
      color: drawingColor,
      pageNumber,
      lineWidth: drawingLineWidth / scale,
      lines: lineSegments,
      text: selectedText,
      image
    };

    // Pass the drawing to the parent component
    onDrawingCreated(underlineDrawing);
  };

  // Create text crossed out drawing (strikethrough)
  const createTextCrossedOut = () => {
    // We'll use getLineSegments to get the base line information, then adjust the y-coordinates
    const lineSegments = getLineSegments();
    if (lineSegments.length === 0) return;

    // Get the selected text
    const selectedText = window.getSelection()?.toString() || '';
    
    // Capture image
    const image = captureTextAnnotationImage();

    // Find the page container
    const pageContainer = document.querySelector(`[data-page-number="${pageNumber}"]`);
    if (!pageContainer) return;
    const pageRect = pageContainer.getBoundingClientRect();

    // Get all selected elements
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    
    // Find all selected elements within this page
    const allSelectedElements: HTMLElement[] = [];
    pageContainer.querySelectorAll('span').forEach(node => {
      if (selection.containsNode(node, true)) {
        if (node.textContent && node.textContent.trim() !== '') {
          allSelectedElements.push(node as HTMLElement);
        }
      }
    });
    
    // Group elements by line based on their y-position
    const lineGroups: HTMLElement[][] = [];
    let currentLine: HTMLElement[] = [];
    let lastY = -1;
    
    // Sort elements by vertical position first
    allSelectedElements.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      return rectA.top - rectB.top;
    });
    
    // Group into lines
    allSelectedElements.forEach(element => {
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
    
    // Now process each line group to find the x-extent and middle y-position
    const crossedOutSegments = lineGroups.map((lineElements, index) => {
      // Use the corresponding lineSegment for x-coordinates if available
      // Otherwise calculate from the elements
      let startX, endX;
      
      if (index < lineSegments.length) {
        startX = lineSegments[index].start.x;
        endX = lineSegments[index].end.x;
      } else {
        // Sort elements in the line by x-coordinate
        lineElements.sort((a, b) => {
          return a.getBoundingClientRect().left - b.getBoundingClientRect().left;
        });
        
        // Get leftmost and rightmost elements
        const firstElement = lineElements[0];
        const lastElement = lineElements[lineElements.length - 1];
        
        const firstRect = firstElement.getBoundingClientRect();
        const lastRect = lastElement.getBoundingClientRect();
        
        startX = (firstRect.left - pageRect.left) / scale;
        endX = (lastRect.right - pageRect.left) / scale;
      }
      
      // Calculate the middle y-position for this line
      let minTop = Infinity;
      let maxBottom = -Infinity;
      
      lineElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const top = (rect.top - pageRect.top) / scale;
        const bottom = (rect.bottom - pageRect.top) / scale;
        minTop = Math.min(minTop, top);
        maxBottom = Math.max(maxBottom, bottom);
      });
      
      // Calculate middle point between top and bottom
      const middleY = minTop + (maxBottom - minTop) / 2;
      
      // Return a line segment that goes through the middle of the text
      return {
        start: { x: startX, y: middleY },
        end: { x: endX, y: middleY }
      };
    });

    // Create the crossed out drawing
    const crossedOutDrawing: Drawing = {
      type: 'textCrossedOut',
      color: drawingColor,
      pageNumber,
      lineWidth: drawingLineWidth / scale,
      lines: crossedOutSegments,
      text: selectedText,
      image
    };

    // Pass the drawing to the parent component
    onDrawingCreated(crossedOutDrawing);
  };

  // Create text highlight drawing
  const createTextHighlight = () => {
    const highlightRects = getHighlightRects();
    if (highlightRects.length === 0) return;

    // Get the selected text
    const selectedText = window.getSelection()?.toString() || '';
    
    // Capture image
    const image = captureTextAnnotationImage();

    // Create the highlight drawing
    const highlightDrawing: Drawing = {
      type: 'textHighlight',
      color: drawingColor,
      pageNumber,
      rects: highlightRects,
      opacity: 0.5, // 50% opacity for highlights
      text: selectedText,
      image
    };

    // Pass the drawing to the parent component
    onDrawingCreated(highlightDrawing);
  };

  return (
    <div className={styles.textToolsContainer}>
      <button 
        className={styles.textToolButton} 
        onClick={createTextUnderline} 
        title='Underline text'>
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
        <span>Underline</span>
      </button>
      
      <button 
        className={styles.textToolButton} 
        onClick={createTextCrossedOut} 
        title='Cross out text'>
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
          <line x1='4' y1='12' x2='20' y2='12' />
          <path d='M6 20v-8a6 6 0 0 1 12 0v8' />
        </svg>
        <span>Cross Out</span>
      </button>
      
      <button 
        className={styles.textToolButton} 
        onClick={createTextHighlight} 
        title='Highlight text'>
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
          <rect x='3' y='5' width='18' height='14' rx='2' ry='2' />
          <path d='M8 5v14' />
          <path d='M16 5v14' />
        </svg>
        <span>Highlight</span>
      </button>
    </div>
  );
};

export default TextAreaTools; 