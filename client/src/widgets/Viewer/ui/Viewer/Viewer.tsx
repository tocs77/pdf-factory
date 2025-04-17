import { useContext, useEffect, useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import { PDFDocumentProxy, PDFPageProxy, getDocument } from 'pdfjs-dist';
import { classNames } from '@/shared/utils';
import { isSliderBeingDragged } from '@/shared/utils';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { ViewerMenu } from '../ViewerMenu/ViewerMenu';
import { Page } from '../Page/Page';
import { ViewerContext } from '../../model/context/viewerContext';
import { ViewerProvider } from '../../model/context/ViewerProvider';
import { scrollToPage } from '../../utils/pageScrollUtils';
import { Drawing, RotationAngle } from '../../model/types/viewerSchema';
import { useZoomToMouse } from '../../hooks/useZoomToMouse';
import { useDragToScroll } from '../../hooks/useDragToScroll';
import { useScrollToDraw } from '../../hooks/useScrollToDraw';
import { DrawingMenu } from '../DrawingMenu/DrawingMenu';
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

  // Use the scrollToDraw hook
  const scrollToDraw = useScrollToDraw({
    containerRef: pdfContainerRef,
    drawings,
    pages,
    selectedPage,
    setSelectedPage,
    scale,
    pageRotations: state.pageRotations,
  });

  // Named function to handle page changes
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (newPage >= 1 && newPage <= pages.length) {
        setSelectedPage(newPage);
        // Add scrolling behavior
        requestAnimationFrame(() => {
          scrollToPage({
            newPage,
            currentPage: selectedPage,
            totalPages: pages.length,
            containerRef: pdfContainerRef,
            pages,
          });
        });
      }
    },
    [pages, selectedPage],
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
    },
    [comparePages.length, pages.length, selectedPage],
  );

  // Callback for child components to notify when they become visible
  const handlePageBecameVisible = useCallback((visiblePageNumber: number) => {
    // Always update the ref to reflect the latest visible page reported
    selectedPageRef.current = visiblePageNumber;

    // Update the state for UI changes (e.g., menu page number)
    setSelectedPage(visiblePageNumber);
  }, []); // Dependency array remains empty

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
          onBecameVisible={handlePageBecameVisible}
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
          onComparePageChange={handleComparePageChange}
        />

        <div
          className={classNames(classes.pdfContainer, {
            [classes.draggable]: isDragToScrollEnabled,
            [classes.dragging]: isDragging,
          })}
          ref={pdfContainerRef}
          onMouseDown={(e) => {
            if (isSliderBeingDragged() || document.body.classList.contains('slider-dragging')) {
              e.stopPropagation();
            }
          }}>
          <div className={classes.pdfContentWrapper}>{renderPages()}</div>

          {drawingMode !== 'none' && <DrawingMenu />}
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
