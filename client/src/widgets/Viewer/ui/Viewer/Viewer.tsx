import { useContext, useEffect, useState, useRef } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { Page } from '../Page/Page';
import { ViewerMenu } from '../ViewerMenu/ViewerMenu';
import { ViewerContext } from '../../model/context/viewerContext';
import { ViewerProvider } from '../../model/context/ViewerProvider';
import { classNames } from '@/shared/utils';
import classes from './Viewer.module.scss';
import { useZoomToMouse } from '../../hooks/useZoomToMouse';
import { Drawing } from '../../model/types/viewerSchema';
interface PdfViewerProps {
  url: string;
  drawings: Drawing[];
  drawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
}

// Internal viewer component that will be wrapped with the provider
const PdfViewerInternal = (props: PdfViewerProps) => {
  const { url, drawings, drawingCreated } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, showThumbnails } = state;

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

    // Scroll to the selected page
    const pageElement = document.getElementById(`page-${pageNumber}`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth' });
    }
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
        <ViewerMenu currentPage={selectedPage} totalPages={pages.length} />

        <div
          className={classNames(classes.pdfContainer, {
            [classes.draggable]: state.drawingMode === 'none',
            [classes.dragging]: isDragging,
          })}
          ref={pdfContainerRef}>
          {state.drawingMode === 'none' && !isDragging && (
            <div className={classes.dragIndicator}>
              <span>Click and drag to scroll</span>
            </div>
          )}
          <div className={classes.pdfContentWrapper}>
            {pages.map((page, index) => (
              <Page
                key={index + 1}
                page={page}
                pageNumber={index + 1}
                id={`page-${index + 1}`}
                drawings={drawings}
                onDrawingCreated={drawingCreated}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrap the internal component with the provider
export const PdfViewer = (props: PdfViewerProps) => (
  <ViewerProvider>
    <PdfViewerInternal {...props} />
  </ViewerProvider>
);
