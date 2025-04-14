import { useContext, useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { Page } from '../Page/Page';
import { ComparePageDiff } from '../ComparePageDiff/ComparePageDiff';
import { ViewerMenu } from '../ViewerMenu/ViewerMenu';
import { ComparePageSideBySide } from '../ComparePageSideBySide/ComparePageSideBySide';
import { ViewerContext } from '../../model/context/viewerContext';
import { ViewerProvider } from '../../model/context/ViewerProvider';
import { classNames } from '@/shared/utils';
import { scrollToPage } from '../../utils/pageScrollUtils';
import { isSliderBeingDragged } from '@/shared/utils';
import classes from './Viewer.module.scss';
import { Drawing, RotationAngle } from '../../model/types/viewerSchema';
import { useZoomToMouse } from '../../hooks/useZoomToMouse';
import { useDragToScroll } from '../../hooks/useDragToScroll';

// Define the ref type for scrollToDraw function
export type PdfViewerRef = {
  scrollToDraw: (id: string) => void;
};

interface PdfViewerProps {
  url: string;
  compareUrl?: string;
  drawings: Drawing[];
  drawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
  onDrawingClicked?: (id: string) => void;
}

// Type for page override mapping
type PageOverrides = Record<number, number>;

// Internal viewer component that will be wrapped with the provider
const PdfViewerInternal = forwardRef<PdfViewerRef, PdfViewerProps>((props, ref) => {
  const { url, drawings, drawingCreated, compareUrl, onDrawingClicked } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, showThumbnails, compareMode, drawingMode } = state;

  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [comparePdfRef, setComparePdfRef] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [comparePages, setComparePages] = useState<PDFPageProxy[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  // Ref to track the current selected page without causing effect re-runs
  const selectedPageRef = useRef(selectedPage);

  // State for comparison page overrides
  const [pageOverrides, setPageOverrides] = useState<PageOverrides>({});

  // Track when the PDF is fully loaded and rendered
  const [pdfRendered, setPdfRendered] = useState(false);

  // Setup drag-to-scroll functionality using the custom hook
  // Enable drag-scroll if no drawing tool is active and PDF is rendered, regardless of compare mode
  const isDragToScrollEnabled = drawingMode === 'none' && pdfRendered;
  const isDragging = useDragToScroll({ containerRef: pdfContainerRef, isEnabled: isDragToScrollEnabled });

  // Setup zoom functionality using the custom hook
  useZoomToMouse({ scale, dispatch, containerRef: pdfContainerRef });

  // Callback for child components to notify when they become visible
  const handlePageBecameVisible = useCallback((visiblePageNumber: number) => {
    // Always update the ref to reflect the latest visible page reported
    selectedPageRef.current = visiblePageNumber;

    // Update the state for UI changes (e.g., menu page number)
    setSelectedPage(visiblePageNumber);

    // console.log(`[Viewer] Page ${visiblePageNumber} became visible. Updating state and ref.`);
  }, []); // Dependency array remains empty

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

  // Load PDF document
  const loadPdf = useCallback(async (pdfUrl: string): Promise<PDFDocumentProxy | null> => {
    try {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      return await loadingTask.promise;
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Failed to load PDF. Please check the URL and try again.');
      setIsLoading(false);
      return null;
    }
  }, []); // No dependencies needed for stable setters

  // Load compare PDF document - only called when compare mode is enabled
  const loadComparePdf = useCallback(
    async (comparePdfUrl: string): Promise<PDFDocumentProxy | null> => {
      if (!compareMode || !comparePdfUrl) {
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
    },
    [compareMode],
  );

  // Load all pages from a PDF document
  const loadPages = useCallback(
    async (document: PDFDocumentProxy | null): Promise<PDFPageProxy[]> => {
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
          const defaultRotation = defaultViewport.rotation as RotationAngle;
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
    },
    [dispatch],
  ); // Add dispatch dependency

  // Effect for loading the main PDF
  useEffect(() => {
    const initPdf = async () => {
      setIsLoading(true);
      setError(null);
      // Reset page overrides when main URL changes
      setPageOverrides({});
      const pdf = await loadPdf(url);
      setPdfRef(pdf);

      // Load compare PDF if URL is provided
      if (compareUrl) {
        const comparePdf = await loadComparePdf(compareUrl);
        setComparePdfRef(comparePdf);
      } else {
        setComparePdfRef(null);
        setComparePages([]);
      }

      setIsLoading(false);
    };

    initPdf();
  }, [url, compareUrl, loadPdf, loadComparePdf]);

  // Effect for loading PDF pages
  useEffect(() => {
    const initPages = async () => {
      if (pdfRef) {
        const loadedPages = await loadPages(pdfRef);
        setPages(loadedPages);
      } else {
        setPages([]);
      }

      // Load compare pages if compare PDF ref exists
      if (comparePdfRef) {
        const loadedComparePages = await loadPages(comparePdfRef);
        setComparePages(loadedComparePages);
      } else {
        setComparePages([]);
      }
    };

    initPages();
  }, [pdfRef, comparePdfRef, loadPages]);

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

  // Set pdfRendered to true when pages are loaded
  useEffect(() => {
    if (pages.length > 0 && !isLoading) {
      setPdfRendered(true);
    }
  }, [pages.length, isLoading]);

  // Render function for pages
  const renderPages = () => {
    if (!pages.length) return null;

    return pages.map((page, index) => {
      const pageNumber = index + 1;
      const pageKey = `page-${pageNumber}`;
      const pageId = `pdf-page-${pageNumber}`;

      // Side-by-Side Compare Mode
      if (state.compareMode === 'sideBySide') {
        // console.log(`[Render ${pageNumber}] SideBySide Mode Check. comparePages.length: ${comparePages.length}`);
        // Determine the comparison page number to use
        const comparePageNumToShow = pageOverrides[pageNumber] ?? pageNumber; // Use override or default
        // console.log(`[Render ${pageNumber}] pageOverrides[${pageNumber}]: ${pageOverrides[pageNumber]}, comparePageNumToShow: ${comparePageNumToShow}`);

        // Get the actual compare page object
        const comparePageObject =
          comparePageNumToShow >= 1 && comparePageNumToShow <= comparePages.length
            ? comparePages[comparePageNumToShow - 1]
            : null;

        // console.log(`[Render ${pageNumber}] Final Compare Page Object: ${comparePageObject ? `Page ${comparePageObject.pageNumber}` : 'null'}`);

        return (
          <ComparePageSideBySide
            key={pageKey}
            page={page}
            comparePage={comparePageObject}
            pageNumber={pageNumber}
            id={pageId}
            className={classes.pageItem}
            onBecameVisible={handlePageBecameVisible}
          />
        );
      }

      // Overlay Compare Mode
      if (state.compareMode === 'diff') {
        // Determine the comparison page number to use
        const comparePageNumToShow = pageOverrides[pageNumber] ?? pageNumber; // Use override or default

        // Get the actual compare page object (adjusting for 0-based index)
        const comparePageObject =
          comparePageNumToShow >= 1 && comparePageNumToShow <= comparePages.length
            ? comparePages[comparePageNumToShow - 1]
            : null; // Handle out-of-bounds or invalid override

        return (
          <ComparePageDiff
            key={pageKey}
            page={page}
            comparePage={comparePageObject} // Pass the potentially shifted page
            pageNumber={pageNumber}
            id={pageId}
            className={classes.pageItem}
            mainColor='#FF0000'
            comparisonColor='#0000FF'
            onBecameVisible={handlePageBecameVisible}
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
          onBecameVisible={handlePageBecameVisible}
          onDrawingClicked={onDrawingClicked}
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
          onPageChange={(newPage) => {
            if (newPage >= 1 && newPage <= pages.length) {
              setSelectedPage(newPage);
            }
          }}
          hasCompare={!!compareUrl}
          comparePage={currentComparePageNum}
          totalComparePages={comparePages.length}
          onComparePageChange={(newComparePageNumInput) => {
            const isValidInput =
              typeof newComparePageNumInput === 'number' &&
              newComparePageNumInput >= 1 &&
              newComparePageNumInput <= comparePages.length;

            const newComparePageNum = isValidInput ? (newComparePageNumInput as number) : null;

            setPageOverrides((prevOverrides) => {
              const oldComparePageForSelected = prevOverrides[selectedPage] ?? selectedPage;

              let shift = 0;
              const newOverrides = { ...prevOverrides };

              if (newComparePageNum !== null) {
                shift = newComparePageNum - oldComparePageForSelected;
                newOverrides[selectedPage] = newComparePageNum;
              } else {
                shift = -(oldComparePageForSelected - selectedPage);
                delete newOverrides[selectedPage];
              }

              if (shift !== 0) {
                for (let pageNum = selectedPage + 1; pageNum <= pages.length; pageNum++) {
                  const currentComparePage = newOverrides[pageNum] ?? pageNum;

                  const shiftedComparePage = currentComparePage + shift;

                  if (shiftedComparePage >= 1 && shiftedComparePage <= comparePages.length) {
                    newOverrides[pageNum] = shiftedComparePage;
                  } else {
                    delete newOverrides[pageNum];
                  }
                }
              }

              return newOverrides;
            });
          }}
        />

        <div
          className={classNames(classes.pdfContainer, {
            // Draggable if no drawing tool AND no compare mode active
            [classes.draggable]: isDragToScrollEnabled,
            [classes.dragging]: isDragging, // Use isDragging from the hook
          })}
          ref={pdfContainerRef}
          onMouseDown={(e) => {
            // If slider is being dragged, prevent drag-to-scroll
            if (isSliderBeingDragged() || document.body.classList.contains('slider-dragging')) {
              e.stopPropagation();
            }
          }}>
          {/* Show drag indicator only if draggable */}
          {isDragToScrollEnabled && !isDragging && (
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
