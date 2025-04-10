import { useContext, useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { Page } from '../Page/Page';
import { ComparePage } from '../ComparePage/ComparePage';
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
  compareUrl?: string;
  drawings: Drawing[];
  drawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
}

// Type for page override mapping
type PageOverrides = Record<number, number>;

// Internal viewer component that will be wrapped with the provider
const PdfViewerInternal = forwardRef<PdfViewerRef, PdfViewerProps>((props, ref) => {
  const { url, drawings, drawingCreated, compareUrl } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, showThumbnails, compareModeEnabled } = state;

  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [comparePdfRef, setComparePdfRef] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [comparePages, setComparePages] = useState<PDFPageProxy[]>([]);
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

  // State for comparison page overrides
  const [pageOverrides, setPageOverrides] = useState<PageOverrides>({});

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

  // Load PDF document
  const loadPdf = async (pdfUrl: string): Promise<PDFDocumentProxy | null> => {
    try {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      return await loadingTask.promise;
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Failed to load PDF. Please check the URL and try again.');
      setIsLoading(false);
      return null;
    }
  };

  // Load compare PDF document - only called when compare mode is enabled
  const loadComparePdf = async (comparePdfUrl: string): Promise<PDFDocumentProxy | null> => {
    if (!compareModeEnabled || !comparePdfUrl) {
      return null;
    }

    try {
      const loadingTask = pdfjs.getDocument(comparePdfUrl);
      return await loadingTask.promise;
    } catch (err) {
      console.error('Error loading comparison PDF:', err);
      setError('Failed to load comparison PDF. Please check the URL and try again.');
      return null;
    }
  };

  // Load all pages from a PDF document
  const loadPages = async (document: PDFDocumentProxy | null): Promise<PDFPageProxy[]> => {
    if (!document) return [];

    try {
      const pagesPromises = [];
      for (let i = 1; i <= document.numPages; i++) {
        pagesPromises.push(document.getPage(i));
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
      return loadedPagesArray;
    } catch (err) {
      console.error('Error loading pages:', err);
      setError('Failed to load PDF pages. Please try again.');
      setIsLoading(false);
      return [];
    }
  };

  // Effect for loading the main PDF
  useEffect(() => {
    const initPdf = async () => {
      setIsLoading(true);
      setError(null);
      // Reset page overrides when main URL changes
      setPageOverrides({});
      const pdf = await loadPdf(url);
      setPdfRef(pdf);

      if (compareModeEnabled && compareUrl) {
        const comparePdf = await loadComparePdf(compareUrl);
        setComparePdfRef(comparePdf);
      } else {
        setComparePdfRef(null); // Clear compare ref if not in compare mode or no URL
        setComparePages([]); // Clear compare pages
      }

      setIsLoading(false);
    };

    initPdf();
  }, [url, compareUrl, compareModeEnabled]);

  // Effect for loading PDF pages
  useEffect(() => {
    const initPages = async () => {
      if (pdfRef) {
        const loadedPages = await loadPages(pdfRef);
        setPages(loadedPages);
      } else {
        setPages([]);
      }

      if (compareModeEnabled && comparePdfRef) {
        const loadedComparePages = await loadPages(comparePdfRef);
        setComparePages(loadedComparePages);
      } else {
        setComparePages([]);
      }
    };

    initPages();
  }, [pdfRef, comparePdfRef, compareModeEnabled]);

  const handleThumbnailClick = (pageNumber: number) => {
    setSelectedPage(pageNumber);
    // Delay scrolling slightly
    requestAnimationFrame(() => {
      scrollToPage({
        newPage: pageNumber,
        currentPage: selectedPage, // Pass previous selectedPage for calculation
        totalPages: pages.length,
        containerRef: pdfContainerRef,
        pages,
      });
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

    container.addEventListener('scroll', handleScroll);
    handleScroll(); // Initial check

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [selectedPage, pages.length, findVisiblePageElement]);

  // Additional effect to update the current page when the container becomes available
  // or when pages are loaded
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container || pages.length === 0) return;

    const visiblePage = findVisiblePageElement();
    if (visiblePage) {
      const pageNumberAttr = visiblePage.getAttribute('data-page-number');
      if (pageNumberAttr) {
        const pageNumber = parseInt(pageNumberAttr, 10);
        setSelectedPage(pageNumber);
      }
    } else {
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

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= pages.length) {
        setSelectedPage(newPage);
        // Delay scrolling
        requestAnimationFrame(() => {
          scrollToPage({
            newPage,
            currentPage: selectedPage, // Pass previous for calculation
            totalPages: pages.length,
            containerRef: pdfContainerRef,
            pages,
          });
        });
      }
    },
    [pages.length, selectedPage],
  );

  // Handler for comparison page override input (triggered by menu input blur/enter)
  const handleComparePageOverrideChange = useCallback(
    (newComparePageNumInput: number | string) => {
      // Validate input: Check if it's a number within the valid range
      const isValidInput =
        typeof newComparePageNumInput === 'number' &&
        newComparePageNumInput >= 1 &&
        newComparePageNumInput <= comparePages.length;

      // Use the validated number or null if input was invalid/cleared
      const newComparePageNum = isValidInput ? (newComparePageNumInput as number) : null;

      setPageOverrides((prevOverrides) => {
        // Get the previous comparison page number for the currently selected main page
        // It's either the existing override or the page number itself if no override existed
        const oldComparePageForSelected = prevOverrides[selectedPage] ?? selectedPage;

        let shift = 0; // Initialize the shift amount
        const newOverrides = { ...prevOverrides }; // Create a mutable copy of the overrides

        if (newComparePageNum !== null) {
          // --- Setting or Changing an Override ---
          // Calculate the shift introduced by this specific change
          shift = newComparePageNum - oldComparePageForSelected;
          // Update the override for the currently selected main page
          newOverrides[selectedPage] = newComparePageNum;
        } else {
          // --- Removing an Override ---
          // Calculate the shift required to undo the effect of the removed override
          // This is the negative of the difference the override was causing compared to the default page number
          shift = -(oldComparePageForSelected - selectedPage);
          // Remove the override for the currently selected main page
          delete newOverrides[selectedPage];
        }

        // --- Propagate the Shift Downwards ---
        // Only propagate if a shift actually occurred (shift !== 0)
        if (shift !== 0) {
          // Iterate through all main pages *after* the one that was just changed
          for (let pageNum = selectedPage + 1; pageNum <= pages.length; pageNum++) {
            // Determine the comparison page number for this subsequent page *before* applying the new shift
            // It's either its existing override or the page number itself
            const currentComparePage = newOverrides[pageNum] ?? pageNum;

            // Calculate the new target comparison page number by applying the calculated shift
            const shiftedComparePage = currentComparePage + shift;

            // Check if the newly calculated comparison page number is valid
            if (shiftedComparePage >= 1 && shiftedComparePage <= comparePages.length) {
              // If valid, update the override for this subsequent page
              newOverrides[pageNum] = shiftedComparePage;
            } else {
              // If the shift pushes the comparison page out of valid bounds,
              // remove any existing override for this subsequent page.
              // This effectively stops the cascade or resets it for this page onwards.
              delete newOverrides[pageNum];
              // Optional: could 'break;' here to stop cascade entirely once one goes out of bounds.
            }
          }
        }

        // Return the updated overrides object to set the state
        return newOverrides;
      });
    },
    [selectedPage, pages.length, comparePages.length],
  ); // Dependencies: selectedPage and total page counts

  // Render function for pages
  const renderPages = () => {
    if (!pages.length) return null;

    return pages.map((page, index) => {
      const pageNumber = index + 1;
      const pageKey = `page-${pageNumber}`;
      const pageId = `pdf-page-${pageNumber}`;

      if (compareModeEnabled) {
        // Determine the comparison page number to use
        const comparePageNumToShow = pageOverrides[pageNumber] ?? pageNumber; // Use override or default

        // Get the actual compare page object (adjusting for 0-based index)
        const comparePageObject =
          comparePageNumToShow >= 1 && comparePageNumToShow <= comparePages.length
            ? comparePages[comparePageNumToShow - 1]
            : null; // Handle out-of-bounds or invalid override

        return (
          <ComparePage
            key={pageKey}
            page={page}
            comparePage={comparePageObject} // Pass the potentially shifted page
            pageNumber={pageNumber}
            id={pageId}
            className={classes.pageItem}
            mainColor='#FF0000'
            comparisonColor='#0000FF'
          />
        );
      }

      // Render normal page if not in compare mode
      return (
        <Page
          key={pageKey}
          page={page}
          pageNumber={pageNumber}
          id={pageId}
          className={classes.pageItem}
          drawings={drawings.filter((d) => d.pageNumber === pageNumber)}
          onDrawingCreated={drawingCreated}
        />
      );
    });
  };

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

  // Calculate the comparison page number to pass to the menu
  const currentComparePageNum = pageOverrides[selectedPage] ?? selectedPage;

  return (
    <div className={classNames(classes.container, { [classes.noThumbnails]: !showThumbnails }, [])}>
      {showThumbnails && (
        <div className={classes.thumbnailsContainer}>
          {pages.map((page, index) => (
            <Thumbnail
              key={`thumbnail-${index + 1}`}
              page={page}
              pageNumber={index + 1}
              isSelected={selectedPage === index + 1}
              onClick={() => handleThumbnailClick(index + 1)}
            />
          ))}
        </div>
      )}

      <div className={classes.viewerContainer}>
        <ViewerMenu
          currentPage={selectedPage}
          totalPages={pages.length}
          onPageChange={handlePageChange}
          hasCompare={!!compareUrl}
          comparePage={currentComparePageNum}
          totalComparePages={comparePages.length}
          onComparePageChange={handleComparePageOverrideChange}
        />

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
          <div className={classes.pdfContentWrapper}>{renderPages()}</div>
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
