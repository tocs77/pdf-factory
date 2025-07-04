import { useContext, useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { PDFDocumentProxy, PDFPageProxy, getDocument } from 'pdfjs-dist';

import { classNames } from '../../utils/classNames';
import { isSliderBeingDragged } from '../../utils/dragControl/dragControl';

import { Thumbnail } from '../Thumbnail/Thumbnail';
import { ViewerMenu } from '../ViewerMenu/ViewerMenu';
import { Page } from '../Page/Page';
import { DrawingMenu } from '../DrawingMenu/DrawingMenu';
import { ViewerContext } from '../../model/context/viewerContext';
import { ViewerProvider } from '../../model/context/ViewerProvider';
import { scrollToPage } from '../../utils/pageScrollUtils';
import { Drawing } from '../../model/types/Drawings';
import { RotationAngle } from '../../model/types/viewerSchema';
import { useZoomToMouse } from '../../hooks/useZoomToMouse';
import { useZoomToPinch } from '../../hooks/useZoomToPinch';
import { useDragToScroll } from '../../hooks/useDragToScroll';
import { useScrollToDraw } from '../../hooks/useScrollToDraw';

import classes from './Viewer.module.scss';

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
  isMobile?: boolean;
}

// Type for page override mapping
type PageOverrides = Record<number, number>;

// Internal viewer component that will be wrapped with the provider
const PdfViewerInternal = forwardRef<PdfViewerRef, PdfViewerProps>((props, ref) => {
  const { url, drawings, drawingCreated, compareUrl, onDrawingClicked, isMobile = false } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, showThumbnails, compareMode, drawingMode, currentPage } = state;

  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [comparePdfRef, setComparePdfRef] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [comparePages, setComparePages] = useState<PDFPageProxy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null!);

  useEffect(() => {
    dispatch({ type: 'setIsMobile', payload: isMobile });
  }, [isMobile, dispatch]);

  // State for comparison page overrides
  const [pageOverrides, setPageOverrides] = useState<PageOverrides>({});

  // Track when the PDF is fully loaded and rendered
  const [pdfRendered, setPdfRendered] = useState(false);

  // Handle touch events for mobile to prevent scrolling during drawing
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container || !isMobile) return;

    const handleTouchStart = (e: TouchEvent) => {
      if (drawingMode !== 'none') {
        // Don't prevent default if touching an element that should ignore touch prevention
        const target = e.target as HTMLElement;
        if (target.closest('[data-dragscroll-ignore="true"]')) {
          return;
        }
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (drawingMode !== 'none') {
        // Don't prevent default if touching an element that should ignore touch prevention
        const target = e.target as HTMLElement;
        if (target.closest('[data-dragscroll-ignore="true"]')) {
          return;
        }
        e.preventDefault();
      }
    };

    // Add event listeners with passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, [isMobile, drawingMode]);

  // Setup drag-to-scroll functionality using the custom hook
  // Enable drag-scroll if no drawing tool is active and PDF is rendered, regardless of compare mode
  // On mobile, disable scroll when in drawing mode to allow for touch drawing
  const isDragToScrollEnabled = drawingMode === 'none' && pdfRendered;
  const isDragging = useDragToScroll({
    containerRef: pdfContainerRef,
    isEnabled: isDragToScrollEnabled,
    isMobile,
  });

  // Setup zoom functionality using the custom hook
  useZoomToMouse({ scale, dispatch, containerRef: pdfContainerRef });

  // Setup pinch zoom functionality for mobile using the custom hook
  const { bind: pinchBind } = useZoomToPinch({
    scale,
    dispatch,
    containerRef: pdfContainerRef,
    isEnabled: isMobile && pdfRendered,
  });

  // Use the scrollToDraw hook
  const scrollToDraw = useScrollToDraw({
    containerRef: pdfContainerRef,
    drawings,
    pages,
    selectedPage: currentPage,
    setSelectedPage: (page) => dispatch({ type: 'setCurrentPage', payload: page }),
    scale,
    pageRotations: state.pageRotations,
  });

  // Named function to handle page changes
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= pages.length) {
        dispatch({ type: 'setCurrentPage', payload: newPage });
        // Add scrolling behavior
        requestAnimationFrame(() => {
          scrollToPage({
            newPage,
            currentPage: currentPage,
            totalPages: pages.length,
            containerRef: pdfContainerRef,
            pages,
          });
        });
      }
    },
    [pages, currentPage, dispatch],
  );

  // Named function to handle compare page changes
  const handleComparePageChange = useCallback(
    (newComparePageNumInput: number) => {
      const isValidInput =
        typeof newComparePageNumInput === 'number' &&
        newComparePageNumInput >= 1 &&
        newComparePageNumInput <= comparePages.length;

      const newComparePageNum = isValidInput ? newComparePageNumInput : null;

      setPageOverrides((prevOverrides) => {
        const oldComparePageForSelected = prevOverrides[currentPage] ?? currentPage;

        let shift = 0;
        const newOverrides = { ...prevOverrides };

        if (newComparePageNum !== null) {
          shift = newComparePageNum - oldComparePageForSelected;
          newOverrides[currentPage] = newComparePageNum;
        } else {
          shift = -(oldComparePageForSelected - currentPage);
          delete newOverrides[currentPage];
        }

        if (shift !== 0) {
          for (let pageNum = currentPage + 1; pageNum <= pages.length; pageNum++) {
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
    },
    [comparePages.length, pages.length, currentPage],
  );

  // Expose scrollToDraw function to parent component
  useImperativeHandle(ref, () => ({
    scrollToDraw,
  }));

  // Load PDF document
  const loadPdf = useCallback(async (pdfUrl: string): Promise<PDFDocumentProxy | null> => {
    try {
      const loadingTask = getDocument(pdfUrl);
      return await loadingTask.promise;
    } catch (err) {
      console.error('Error loading PDF:', err);
      setError('Не удалось загрузить PDF. Пожалуйста, проверьте URL и попробуйте снова.');
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
        const loadingTask = getDocument(comparePdfUrl);
        return await loadingTask.promise;
      } catch (err) {
        console.error('Error loading comparison PDF:', err);
        setError('Не удалось загрузить PDF для сравнения. Пожалуйста, проверьте URL и попробуйте снова.');
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
        setError('Не удалось загрузить страницы PDF. Пожалуйста, попробуйте снова.');
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
    handlePageChange(pageNumber);
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

      // Determine the comparison page number to use
      const comparePageNumToShow = pageOverrides[pageNumber] ?? pageNumber; // Use override or default

      // Get the actual compare page object (adjusting for 0-based index)
      const comparePageObject =
        comparePageNumToShow >= 1 && comparePageNumToShow <= comparePages.length ? comparePages[comparePageNumToShow - 1] : null;

      return (
        <Page
          key={`page-${pageNumber}`}
          page={page}
          pageNumber={pageNumber}
          compareMode={state.compareMode}
          comparePage={comparePageObject}
          drawings={drawings}
          drawingCreated={drawingCreated}
          onDrawingClicked={onDrawingClicked}
          className={classes.pageItem}
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
            <div className={classes.loadingTitle}>Загрузка PDF...</div>
            <div className={classes.spinner}></div>
          </div>
        ) : (
          <div className={classes.errorBox}>{error}</div>
        )}
      </div>
    );
  }

  // Calculate the comparison page number to pass to the menu
  const currentComparePageNum = pageOverrides[currentPage] ?? currentPage;

  return (
    <div className={classNames(classes.container, { [classes.noThumbnails]: !showThumbnails }, [])}>
      {showThumbnails && (
        <div className={classes.thumbnailsContainer}>
          {pages.map((page, index) => (
            <Thumbnail
              key={`thumbnail-${index + 1}`}
              page={page}
              pageNumber={index + 1}
              isSelected={currentPage === index + 1}
              onClick={() => handleThumbnailClick(index + 1)}
            />
          ))}
        </div>
      )}

      <div className={classes.viewerContainer}>
        <ViewerMenu
          currentPage={currentPage}
          totalPages={pages.length}
          onPageChange={handlePageChange}
          hasCompare={!!compareUrl}
          comparePage={currentComparePageNum}
          totalComparePages={comparePages.length}
          onComparePageChange={handleComparePageChange}
        />

        <div
          className={classNames(classes.pdfContainer, {
            [classes.draggable]: isDragToScrollEnabled,
            [classes.dragging]: isDragging,
          })}
          ref={pdfContainerRef}
          {...(isMobile ? pinchBind() : {})}
          onMouseDown={(e) => {
            if (isSliderBeingDragged() || document.body.classList.contains('slider-dragging')) {
              e.stopPropagation();
            }
          }}>
          <div className={classes.pdfContentWrapper}>{renderPages()}</div>

          {drawingMode !== 'none' && drawingMode !== 'zoomArea' && <DrawingMenu />}
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
