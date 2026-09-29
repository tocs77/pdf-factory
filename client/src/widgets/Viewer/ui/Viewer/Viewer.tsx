import { getDocument, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import type { DocumentInitParameters } from 'pdfjs-dist/types/src/display/api';
import { forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { useMatchPagesMutation } from '@/entities/File';

import { useDragToScroll } from '../../hooks/useDragToScroll';
import { useScrollToDraw } from '../../hooks/useScrollToDraw';
import { useZoomToMouse } from '../../hooks/useZoomToMouse';
import { useZoomToPinch } from '../../hooks/useZoomToPinch';
import { ViewerProvider } from '../../model/context/ViewerProvider';
import { ViewerContext } from '../../model/context/viewerContext';
import type { Drawing } from '../../model/types/Drawings';
import type { RotationAngle } from '../../model/types/viewerSchema';
import { classNames } from '../../utils/classNames';
import { isSliderBeingDragged } from '../../utils/dragControl/dragControl';
import { scrollToPage } from '../../utils/pageScrollUtils';
import { DrawingMenu } from '../DrawingMenu/DrawingMenu';
import { DrawingMenuMobile } from '../DrawingMenuMobile';
import { Page } from '../Page/Page';
import { ThumbnailsMenu } from '../ThumbnailsMenu/ThubnaislMenu';
import { ViewerMenu } from '../ViewerMenu/ViewerMenu';

import classes from './Viewer.module.scss';

// Define the ref type for scrollToDraw function
export type PdfViewerRef = {
  scrollToDraw: (id: string) => void;
};

interface PdfViewerProps {
  compareUrl?: string;
  compareFileId?: string;
  drawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
  drawings: Drawing[];
  extendedControls?: React.ReactNode;
  fileId?: string;
  id?: string;
  isMobile?: boolean;
  onDrawingClicked?: (id: string) => void;
  url: string;
  viewOnly?: boolean;
}

// Type for page override mapping. `null` means the page has no counterpart
// in the compare document (it was removed in the compare version).
type PageOverrides = Record<number, number | null>;

// pdfjs-dist assets (wasm decoders, cmaps, standard fonts, icc profiles) are
// served from `<base>/pdfjs/` by the pdfjsAssets vite plugin.
const pdfjsAssetsBase = `${import.meta.env.BASE_URL}/pdfjs/`.replace(/\/{2,}/g, '/');

const createDocumentParams = (url: string): DocumentInitParameters => ({
  url,
  cMapUrl: `${pdfjsAssetsBase}cmaps/`,
  cMapPacked: true,
  iccUrl: `${pdfjsAssetsBase}iccs/`,
  standardFontDataUrl: `${pdfjsAssetsBase}standard_fonts/`,
  wasmUrl: `${pdfjsAssetsBase}wasm/`,
});

// Internal viewer component that will be wrapped with the provider
const PdfViewerInternal = forwardRef<PdfViewerRef, PdfViewerProps>((props, ref) => {
  const {
    url,
    drawings,
    drawingCreated,
    compareUrl,
    compareFileId,
    onDrawingClicked,
    isMobile = false,
    viewOnly = false,
    extendedControls,
    id,
    fileId,
  } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, showThumbnails, compareMode, drawingMode, currentPage, zoomWithCtrl, currentDrawingPage } = state;

  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [comparePdfRef, setComparePdfRef] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [comparePages, setComparePages] = useState<PDFPageProxy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null!);
  const hasRestoredPageRef = useRef(false);

  useEffect(() => {
    dispatch({ type: 'setIsMobile', payload: isMobile });
  }, [isMobile, dispatch]);

  // Set drawing mode to 'none' when viewOnly is true
  useEffect(() => {
    if (viewOnly && drawingMode !== 'none') {
      dispatch({ type: 'setDrawingMode', payload: 'none' });
    }
  }, [viewOnly, drawingMode, dispatch]);

  // Set compare mode to 'none' when compareUrl is empty or undefined
  useEffect(() => {
    if ((!compareUrl || compareUrl === '') && compareMode !== 'none') {
      dispatch({ type: 'setCompareMode', payload: 'none' });
    }
  }, [compareUrl, compareMode, dispatch]);

  // State for comparison page overrides
  const [pageOverrides, setPageOverrides] = useState<PageOverrides>({});
  // Number of compare-only pages inserted after a given main page
  // (key 0 = pages added before the first main page)
  const [addedPages, setAddedPages] = useState<Record<number, number>>({});
  const [matchPages, { isLoading: isMatching }] = useMatchPagesMutation();

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
  useDragToScroll({
    containerRef: pdfContainerRef,
    isEnabled: isDragToScrollEnabled,
    isMobile,
  });

  // Setup zoom functionality using the custom hook
  useZoomToMouse({ scale, dispatch, containerRef: pdfContainerRef, zoomWithCtrl });

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
            // Pages explicitly marked as having no counterpart keep that status
            if (newOverrides[pageNum] === null) continue;
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

  // Auto-match pages between the main and compare documents
  const handleAutoMatch = useCallback(async () => {
    if (!fileId || !compareFileId || isMatching) return;

    try {
      const result = await matchPages({ fileIdA: fileId, fileIdB: compareFileId }).unwrap();

      const overrides: PageOverrides = {};
      const added: Record<number, number> = {};
      let lastPageA = 0;

      for (const pair of result.pairs) {
        if (pair.page_a !== null) {
          lastPageA = pair.page_a;
          overrides[pair.page_a] = pair.status === 'matched' ? pair.page_b : null;
        } else if (pair.page_b !== null) {
          added[lastPageA] = (added[lastPageA] ?? 0) + 1;
        }
      }

      setPageOverrides(overrides);
      setAddedPages(added);
    } catch (err) {
      console.error('Page auto-match failed:', err);
    }
  }, [fileId, compareFileId, isMatching, matchPages]);

  // Expose scrollToDraw function to parent component
  useImperativeHandle(ref, () => ({
    scrollToDraw,
  }));

  // Load PDF document
  const loadPdf = useCallback(async (pdfUrl: string): Promise<PDFDocumentProxy | null> => {
    if (!pdfUrl) return null;
    try {
      const loadingTask = getDocument(createDocumentParams(pdfUrl));
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
        const loadingTask = getDocument(createDocumentParams(comparePdfUrl));
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
      setAddedPages({});
      // Reset restore flag when URL changes
      hasRestoredPageRef.current = false;
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

  // Restore last viewed page from localStorage when id is provided
  useEffect(() => {
    if (!id || pages.length === 0 || !pdfRendered || hasRestoredPageRef.current) return;

    try {
      const storageKey = `pdf-viewer-${id}-last-page`;
      const savedPage = localStorage.getItem(storageKey);
      if (savedPage) {
        const pageNumber = Number.parseInt(savedPage, 10);
        if (pageNumber >= 1 && pageNumber <= pages.length) {
          hasRestoredPageRef.current = true;
          handlePageChange(pageNumber);
        }
      }
    } catch (error) {
      console.error('Error restoring last page from localStorage:', error);
    }
  }, [id, pages, pdfRendered, handlePageChange]);

  // Save current page to localStorage on unmount
  useEffect(() => {
    if (!id) return;

    return () => {
      try {
        const storageKey = `pdf-viewer-${id}-last-page`;
        localStorage.setItem(storageKey, currentPage.toString());
      } catch (error) {
        console.error('Error saving last page to localStorage:', error);
      }
    };
  }, [id, currentPage]);

  // Render function for pages
  const renderPages = () => {
    if (!pages.length) return null;

    return pages.map((page, index) => {
      const pageNumber = index + 1;

      // Determine the comparison page number to use. A key explicitly set to
      // `null` means the page has no counterpart in the compare document.
      const comparePageNumToShow = pageNumber in pageOverrides ? pageOverrides[pageNumber] : pageNumber;

      // Get the actual compare page object (adjusting for 0-based index)
      const comparePageObject =
        comparePageNumToShow !== null && comparePageNumToShow >= 1 && comparePageNumToShow <= comparePages.length
          ? comparePages[comparePageNumToShow - 1]
          : null;

      const inactiveDrawingPage = currentDrawingPage > 0 && pageNumber !== currentDrawingPage;
      const showMatchBadges = compareMode !== 'none';
      const isRemoved = showMatchBadges && pageNumber in pageOverrides && pageOverrides[pageNumber] === null;
      // addedPages[0] = compare-only pages that come before main page 1
      const addedBefore = pageNumber === 1 ? (addedPages[0] ?? 0) : 0;
      const addedAfter = addedPages[pageNumber] ?? 0;

      return (
        <div className={classes.pageWrapper} key={`page-${pageNumber}`}>
          {showMatchBadges && addedBefore > 0 && (
            <div className={classes.addedChip}>+{addedBefore} стр. только в файле сравнения</div>
          )}
          <div className={classes.pageBox}>
            <Page
              className={classNames(classes.pageItem, { [classes.inactive]: inactiveDrawingPage })}
              compareMode={state.compareMode}
              comparePage={comparePageObject}
              drawingCreated={drawingCreated}
              drawings={drawings}
              mobile={isMobile}
              onDrawingClicked={onDrawingClicked}
              page={page}
              pageNumber={pageNumber}
            />
            {isRemoved && <div className={classes.removedBadge}>Нет соответствия в файле сравнения</div>}
          </div>
          {showMatchBadges && addedAfter > 0 && (
            <div className={classes.addedChip}>+{addedAfter} стр. только в файле сравнения</div>
          )}
        </div>
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
  const currentComparePageNum = currentPage in pageOverrides ? pageOverrides[currentPage] : currentPage;

  return (
    <div className={classNames(classes.container, { [classes.noThumbnails]: !showThumbnails }, [])}>
      {showThumbnails && (
        <ThumbnailsMenu
          compareMode={compareMode}
          comparePage={currentComparePageNum}
          currentPage={currentPage}
          onComparePageChange={handleComparePageChange}
          onPageChange={handlePageChange}
          onThumbnailClick={handleThumbnailClick}
          pages={pages}
          totalComparePages={comparePages.length}
          totalPages={pages.length}
        />
      )}

      <div className={classes.viewerContainer}>
        <ViewerMenu
          currentPage={currentPage}
          extendedControls={extendedControls}
          hasCompare={!!compareUrl}
          isMatching={isMatching}
          mobile={isMobile}
          onAutoMatch={fileId && compareFileId ? handleAutoMatch : undefined}
          onPageChange={handlePageChange}
          viewOnly={viewOnly}
        />

        <div
          className={classNames(classes.pdfContainer, { [classes.draggable]: isDragToScrollEnabled })}
          ref={pdfContainerRef}
          {...(isMobile ? pinchBind() : {})}
          onMouseDown={(e) => {
            if (isSliderBeingDragged() || document.body.classList.contains('slider-dragging')) {
              e.stopPropagation();
            }
          }}>
          <div className={classes.pdfContentWrapper}>{renderPages()}</div>

          {drawingMode !== 'none' && drawingMode !== 'zoomArea' && (isMobile ? <DrawingMenuMobile /> : <DrawingMenu />)}
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
