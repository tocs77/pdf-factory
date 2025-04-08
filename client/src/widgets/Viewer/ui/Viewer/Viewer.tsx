import { useContext, useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { Page } from '../Page/Page';
import ComparePage from '../ComparePage/ComparePage';
import { ViewerMenu } from '../ViewerMenu/ViewerMenu';
import { ViewerContext } from '../../model/context/viewerContext';
import { ViewerProvider } from '../../model/context/ViewerProvider';
import { classNames } from '@/shared/utils';
import { scrollToPage } from '../../utils/pageScrollUtils';
import classes from './Viewer.module.scss';
import { useZoomToMouse } from '../../hooks/useZoomToMouse';
import { Drawing } from '../../model/types/viewerSchema';

// Define the ref type for scrollToDraw function
export type PdfViewerRef = {
  scrollToDraw: (id: string) => void;
};

interface PdfViewerProps {
  url: string;
  drawings: Drawing[];
  drawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
}

// Internal viewer component that will be wrapped with the provider
const PdfViewerInternal = forwardRef<PdfViewerRef, PdfViewerProps>((props, ref) => {
  const { url, drawings, drawingCreated } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, showThumbnails, compareModeEnabled } = state;

  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // State for drag-to-scroll functionality
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [scrollStartX, setScrollStartX] = useState(0);
  const [scrollStartY, setScrollStartY] = useState(0);

  // Use the zoom to mouse hook
  const { findVisiblePageElement, handleScaleChange } = useZoomToMouse({
    scale,
    dispatch,
    containerRef: pdfContainerRef,
  });

  // Expose scrollToDraw function to parent component
  useImperativeHandle(ref, () => ({
    scrollToDraw: (id: string) => {
      if (!pdfContainerRef.current || !drawings || drawings.length === 0) return;

      // Find the drawing with the matching ID
      const drawing = drawings.find((d) => d.id === id);
      if (!drawing) {
        console.warn(`Drawing with ID ${id} not found`);
        return;
      }
      console.log('Drawing found:', drawing);
      // Get the page number from the drawing
      const pageNumber = drawing.pageNumber;

      // Get the rotation angle for this page
      const rotation = state.pageRotations[pageNumber] || 0;

      // Update the selected page
      setSelectedPage(pageNumber);

      // First scroll to the page to ensure it's loaded and visible
      scrollToPage({
        newPage: pageNumber,
        currentPage: selectedPage,
        totalPages: pages.length,
        containerRef: pdfContainerRef,
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
        if (!pageElement || !pdfContainerRef.current) return;

        // Get the page rect and container rect
        const pageRect = pageElement.getBoundingClientRect();
        const containerRect = pdfContainerRef.current.getBoundingClientRect();

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
        const scrollLeft = pdfContainerRef.current.scrollLeft + (drawingCenterX - containerRect.left) - containerRect.width / 2;

        const scrollTop = pdfContainerRef.current.scrollTop + (drawingCenterY - containerRect.top) - containerRect.height / 2;

        // Smooth scroll to center the drawing in both directions
        pdfContainerRef.current.scrollTo({
          left: scrollLeft,
          top: scrollTop,
          behavior: 'smooth',
        });
      }, 250); // Longer delay to ensure page is fully loaded and scrolled into view
    },
  }));

  // Create a ref to track previous scale value
  const prevScaleRef = useRef(scale);

  // Track scale changes and adjust scroll position
  useEffect(() => {
    // Only handle scale changes, not initial render
    if (prevScaleRef.current !== scale) {
      handleScaleChange(prevScaleRef.current);
      // Update the ref for next comparison
      prevScaleRef.current = scale;
    }
  }, [scale, handleScaleChange]);

  // Load all pages when PDF is loaded
  useEffect(() => {
    const loadPages = async () => {
      if (!pdfRef) return;

      try {
        const pagesPromises = [];
        for (let i = 1; i <= pdfRef.numPages; i++) {
          pagesPromises.push(pdfRef.getPage(i));
        }

        const loadedPagesArray = await Promise.all(pagesPromises);
        // Get default rotation for each page and set it in the context
        loadedPagesArray.forEach((page, index) => {
          const pageNumber = index + 1;

          const defaultViewport = page.getViewport({ scale: 1 });
          const defaultRotation = defaultViewport.rotation;
          // Only update context if there's a rotation value
          if (defaultRotation !== undefined) {
            dispatch({
              type: 'setPageRotation',
              payload: { pageNumber, angle: defaultRotation },
            });
          }
        });
        setPages(loadedPagesArray);
        setIsLoading(false);
      } catch (err) {
        console.error('Error loading pages:', err);
        setError('Failed to load PDF pages. Please try again.');
        setIsLoading(false);
      }
    };

    loadPages();
  }, [pdfRef]);

  useEffect(() => {
    const loadPdf = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const loadingTask = pdfjs.getDocument(url);
        const loadedPdf = await loadingTask.promise;
        setPdfRef(loadedPdf);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setError('Failed to load PDF. Please check the URL and try again.');
        setIsLoading(false);
      }
    };

    loadPdf();
  }, [url]);

  const handleThumbnailClick = (pageNumber: number) => {
    setSelectedPage(pageNumber);

    // Use the utility function for consistent scrolling behavior
    scrollToPage({
      newPage: pageNumber,
      currentPage: selectedPage,
      totalPages: pages.length,
      containerRef: pdfContainerRef,
      pages,
    });
  };

  // Update current page on scroll - this effect sets up the scroll handler
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const visiblePage = findVisiblePageElement();

      if (visiblePage) {
        const pageNumberAttr = visiblePage.getAttribute('data-page-number');
        if (pageNumberAttr) {
          const pageNumber = parseInt(pageNumberAttr, 10);
          if (pageNumber !== selectedPage) {
            setSelectedPage(pageNumber);
          }
        }
      }
    };

    // Add the scroll event listener
    container.addEventListener('scroll', handleScroll);

    // Run the handler once to set the initial page
    handleScroll();

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [selectedPage, pages.length, findVisiblePageElement]);

  // Additional effect to update the current page when the container becomes available
  // or when pages are loaded
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container || pages.length === 0) return;

    // Find the most visible page and update selectedPage
    const visiblePage = findVisiblePageElement();
    if (visiblePage) {
      const pageNumberAttr = visiblePage.getAttribute('data-page-number');
      if (pageNumberAttr) {
        const pageNumber = parseInt(pageNumberAttr, 10);
        setSelectedPage(pageNumber);
      }
    } else {
      // If no page is visible yet, default to page 1
      setSelectedPage(1);
    }
  }, [pages.length, findVisiblePageElement]);

  // Track when the PDF is fully loaded and rendered
  const [pdfRendered, setPdfRendered] = useState(false);

  // Set pdfRendered to true when pages are loaded
  useEffect(() => {
    if (pages.length > 0 && !isLoading) {
      setPdfRendered(true);
    }
  }, [pages.length, isLoading]);

  // Implement drag-to-scroll functionality
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container || !pdfRendered) return;

    // Only enable drag-to-scroll when no drawing tools are active
    if (state.drawingMode !== 'none') return;

    console.log('Setting up drag-to-scroll functionality');

    const handleMouseDown = (e: MouseEvent) => {
      // Only activate on left mouse button
      if (e.button !== 0) return;

      // Don't activate if Ctrl key is pressed (for zoom)
      if (e.ctrlKey) return;

      // Set dragging state
      setIsDragging(true);

      // Store initial mouse position
      setDragStartX(e.clientX);
      setDragStartY(e.clientY);

      // Store initial scroll position
      setScrollStartX(container.scrollLeft);
      setScrollStartY(container.scrollTop);

      // Prevent default behavior
      e.preventDefault();
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      // Calculate how far the mouse has moved
      const deltaX = e.clientX - dragStartX;
      const deltaY = e.clientY - dragStartY;

      // Scroll the container in the opposite direction of the mouse movement
      container.scrollLeft = scrollStartX - deltaX;
      container.scrollTop = scrollStartY - deltaY;

      // Prevent default behavior
      e.preventDefault();
    };

    const handleMouseUp = () => {
      if (!isDragging) return;

      // Reset dragging state
      setIsDragging(false);
    };

    // Add event listeners
    container.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Clean up
    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartX, dragStartY, scrollStartX, scrollStartY, state.drawingMode, pdfRendered]);

  const handlePageChange = (newPage: number) => {
    // Update the selected page state
    setSelectedPage(newPage);

    // Use the utility function to handle scrolling logic
    scrollToPage({
      newPage,
      currentPage: selectedPage,
      totalPages: pages.length,
      containerRef: pdfContainerRef,
      pages,
    });
  };

  // Define placeholder comparison colors
  const compareColor1 = '#FF0000'; // Red
  const compareColor2 = '#0000FF'; // Blue

  // Show loading message or error
  if (isLoading || error) {
    return (
      <div className={classes.loadingContainer}>
        {isLoading ? (
          <div className={classes.loadingBox}>
            <div className={classes.loadingTitle}>Loading PDF...</div>
            <div className={classes.spinner}></div>
          </div>
        ) : (
          <div className={classes.errorBox}>{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className={classNames(classes.container, { [classes.noThumbnails]: !showThumbnails }, [])}>
      {showThumbnails && (
        <div className={classes.thumbnailsContainer}>
          {pages.map((page, index) => (
            <Thumbnail
              key={index + 1}
              page={page}
              pageNumber={index + 1}
              isSelected={selectedPage === index + 1}
              onClick={handleThumbnailClick}
            />
          ))}
        </div>
      )}

      <div className={classes.viewerContainer}>
        <ViewerMenu currentPage={selectedPage} totalPages={pages.length} onPageChange={handlePageChange} />

        <div
          className={classNames(classes.pdfContainer, {
            [classes.draggable]: state.drawingMode === 'none' && !compareModeEnabled,
            [classes.dragging]: isDragging,
          })}
          ref={pdfContainerRef}>
          {state.drawingMode === 'none' && !compareModeEnabled && !isDragging && (
            <div className={classes.dragIndicator}>
              <span>Click and drag to scroll</span>
            </div>
          )}
          <div className={classes.pdfContentWrapper}>
            {pages.map((page, index) => {
              const pageNumber = index + 1;
              const pageId = `page-${pageNumber}`;
              const comparePageId = `compare-page-${pageNumber}`;

              // Determine color for compare mode (simple alternating example)
              const comparisonColor = pageNumber % 2 ? compareColor1 : compareColor2;

              return compareModeEnabled ? (
                <ComparePage
                  key={comparePageId}
                  id={comparePageId}
                  page={page}
                  pageNumber={pageNumber}
                  comparisonColor={comparisonColor}
                />
              ) : (
                <Page
                  key={pageId}
                  id={pageId}
                  page={page}
                  pageNumber={pageNumber}
                  drawings={drawings}
                  onDrawingCreated={drawingCreated}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

// Wrap the internal component with the provider and forward the ref
export const PdfViewer = forwardRef<PdfViewerRef, PdfViewerProps>((props, ref) => (
  <ViewerProvider>
    <PdfViewerInternal {...props} ref={ref} />
  </ViewerProvider>
));
