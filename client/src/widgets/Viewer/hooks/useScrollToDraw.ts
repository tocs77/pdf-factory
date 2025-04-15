import { useCallback } from 'react';
import { RefObject } from 'react';
import { Drawing } from '../model/types/viewerSchema';
import { scrollToPage } from '../utils/pageScrollUtils';
import { PDFPageProxy } from 'pdfjs-dist';

interface UseScrollToDrawParams {
  containerRef: RefObject<HTMLDivElement>;
  drawings: Drawing[];
  pages: PDFPageProxy[];
  selectedPage: number;
  setSelectedPage: (page: number) => void;
  scale: number;
  pageRotations: Record<number, number>;
}

/**
 * Custom hook that provides a function to scroll to a specific drawing
 */
export const useScrollToDraw = ({
  containerRef,
  drawings,
  pages,
  selectedPage,
  setSelectedPage,
  scale,
  pageRotations,
}: UseScrollToDrawParams) => {
  
  return useCallback((id: string) => {
    if (!containerRef.current || !drawings || drawings.length === 0) return;

    // Find the drawing with the matching ID
    const drawing = drawings.find((d) => d.id === id);
    if (!drawing) {
      console.warn(`Drawing with ID ${id} not found`);
      return;
    }
    // Get the page number from the drawing
    const pageNumber = drawing.pageNumber;

    // Get the rotation angle for this page
    const rotation = pageRotations[pageNumber] || 0;

    // Update the selected page
    setSelectedPage(pageNumber);

    // First scroll to the page to ensure it's loaded and visible
    scrollToPage({
      newPage: pageNumber,
      currentPage: selectedPage,
      totalPages: pages.length,
      containerRef,
      pages,
    });

    // After page is in view, scroll to the drawing precisely
    setTimeout(() => {
      // Ensure the drawing has boundingBox data
      if (!drawing.boundingBox) {
        console.warn(`Drawing with ID ${id} does not have boundingBox coordinates`);
        return;
      }

      // Find the page element
      const pageElement = document.querySelector(`[data-page-number="${pageNumber}"]`);
      if (!pageElement || !containerRef.current) return;

      // Get the page rect and container rect
      const pageRect = pageElement.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();

      // Get normalized bounding box
      const { left, right, top, bottom } = drawing.boundingBox;

      // Calculate page center point - needed for rotation transformation
      const pageWidth = pageRect.width;
      const pageHeight = pageRect.height;

      // Apply rotation transformation to drawing coordinates based on page rotation
      let drawingLeft, drawingRight, drawingTop, drawingBottom;

      // Transform coordinates based on rotation angle
      switch (rotation) {
        case 0: // No rotation
          drawingLeft = pageRect.left + left * scale;
          drawingRight = pageRect.left + right * scale;
          drawingTop = pageRect.top + top * scale;
          drawingBottom = pageRect.top + bottom * scale;
          break;

        case 90: // 90 degrees clockwise
          // In 90° rotation, x becomes y and y becomes -x
          drawingLeft = pageRect.left + (pageHeight - bottom * scale);
          drawingRight = pageRect.left + (pageHeight - top * scale);
          drawingTop = pageRect.top + left * scale;
          drawingBottom = pageRect.top + right * scale;
          break;

        case 180: // 180 degrees
          // In 180° rotation, x becomes -x and y becomes -y
          drawingLeft = pageRect.left + (pageWidth - right * scale);
          drawingRight = pageRect.left + (pageWidth - left * scale);
          drawingTop = pageRect.top + (pageHeight - bottom * scale);
          drawingBottom = pageRect.top + (pageHeight - top * scale);
          break;

        case 270: // 270 degrees clockwise (90 counterclockwise)
          // In 270° rotation, x becomes -y and y becomes x
          drawingLeft = pageRect.left + top * scale;
          drawingRight = pageRect.left + bottom * scale;
          drawingTop = pageRect.top + (pageWidth - right * scale);
          drawingBottom = pageRect.top + (pageWidth - left * scale);
          break;

        default:
          // If rotation is not one of the standard angles, use the original coordinates
          drawingLeft = pageRect.left + left * scale;
          drawingRight = pageRect.left + right * scale;
          drawingTop = pageRect.top + top * scale;
          drawingBottom = pageRect.top + bottom * scale;
      }

      // Calculate drawing dimensions and center point
      const drawingWidth = drawingRight - drawingLeft;
      const drawingHeight = drawingBottom - drawingTop;
      const drawingCenterX = drawingLeft + drawingWidth / 2;
      const drawingCenterY = drawingTop + drawingHeight / 2;

      // Calculate the scroll positions to center the drawing in the viewport
      const scrollLeft = containerRef.current.scrollLeft + (drawingCenterX - containerRect.left) - containerRect.width / 2;

      const scrollTop = containerRef.current.scrollTop + (drawingCenterY - containerRect.top) - containerRect.height / 2;

      // Smooth scroll to center the drawing in both directions
      containerRef.current.scrollTo({
        left: scrollLeft,
        top: scrollTop,
        behavior: 'smooth',
      });
    }, 250); // Longer delay to ensure page is fully loaded and scrolled into view
  }, [containerRef, drawings, pages, selectedPage, setSelectedPage, scale, pageRotations]);
}; 