import { PDFPageProxy } from 'pdfjs-dist';
import { useContext, useEffect, useRef } from 'react';

import { ViewPage } from '../ViewPage/ViewPage';
import { ComparePageDiff } from '../ComparePageDiff/ComparePageDiff';
import { ComparePageSideBySide } from '../ComparePageSideBySide/ComparePageSideBySide';
import { Drawing } from '../../model/types/viewerSchema';
import { ViewerContext } from '../../model/context/viewerContext';

interface PageProps {
  page: PDFPageProxy;
  pageNumber: number;
  compareMode?: 'sideBySide' | 'diff' | 'none';
  comparePage?: PDFPageProxy | null;
  drawings: Drawing[];
  drawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
  onDrawingClicked?: (id: string) => void;
  className?: string;
}

export const Page = (props: PageProps) => {
  const {
    page,
    pageNumber,
    compareMode = 'none',
    comparePage = null,
    drawings,
    drawingCreated,
    onDrawingClicked,
    className,
  } = props;

  const { state, dispatch } = useContext(ViewerContext);
  const { currentPage, pageRotations } = state;

  // Ref to track whether this is the current visible page to avoid infinite rerenders
  const isCurrentlyVisibleRef = useRef(false);

  // Track rotation changes
  const prevRotationRef = useRef(pageRotations[pageNumber] || 0);
  const rotationChangedRef = useRef(false);
  const rotationStabilizationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Update rotation tracking
  useEffect(() => {
    const currentRotation = pageRotations[pageNumber] || 0;
    const prevRotation = prevRotationRef.current;

    if (currentRotation !== prevRotation) {
      rotationChangedRef.current = true;
      prevRotationRef.current = currentRotation;

      // Clear any existing timer
      if (rotationStabilizationTimerRef.current) {
        clearTimeout(rotationStabilizationTimerRef.current);
      }

      // Set a timer to reset the rotation changed flag after 1 second
      rotationStabilizationTimerRef.current = setTimeout(() => {
        rotationChangedRef.current = false;
        rotationStabilizationTimerRef.current = null;
      }, 1000);
    }

    return () => {
      if (rotationStabilizationTimerRef.current) {
        clearTimeout(rotationStabilizationTimerRef.current);
      }
    };
  }, [pageNumber, pageRotations]);

  // Internal handler for when a page becomes visible
  const handlePageBecameVisible = (visiblePageNumber: number) => {
    // Don't update current page if this page has recently had its rotation changed
    if (visiblePageNumber === pageNumber && rotationChangedRef.current) {
      return;
    }

    // If another page becomes visible after a page rotation, ignore it for a brief period
    // This prevents the wrong page from becoming the current page during rotation layout changes
    const isAnyPageRotating = Object.keys(pageRotations).some((key) => {
      const pageNum = parseInt(key, 10);
      return pageNum !== pageNumber && pageRotations[pageNum] !== prevRotationRef.current;
    });

    if (isAnyPageRotating) {
      return;
    }

    // Only update context if this page isn't already the current page
    // This prevents infinite rerenders
    if (visiblePageNumber === pageNumber && !isCurrentlyVisibleRef.current) {
      isCurrentlyVisibleRef.current = true;
      dispatch({ type: 'setCurrentPage', payload: visiblePageNumber });
    } else if (visiblePageNumber !== pageNumber && isCurrentlyVisibleRef.current) {
      isCurrentlyVisibleRef.current = false;
    }
  };

  // Reset visibility status when currentPage changes externally
  useEffect(() => {
    isCurrentlyVisibleRef.current = currentPage === pageNumber;
  }, [currentPage, pageNumber]);

  const pageKey = `page-${pageNumber}`;
  const pageId = `pdf-page-${pageNumber}`;

  // Side-by-Side Compare Mode
  if (compareMode === 'sideBySide') {
    return (
      <ComparePageSideBySide
        key={pageKey}
        page={page}
        comparePage={comparePage}
        pageNumber={pageNumber}
        id={pageId}
        className={className}
        onBecameVisible={handlePageBecameVisible}
      />
    );
  }

  // Overlay Compare Mode
  if (compareMode === 'diff') {
    return (
      <ComparePageDiff
        key={pageKey}
        page={page}
        comparePage={comparePage}
        pageNumber={pageNumber}
        id={pageId}
        className={className}
        mainColor='#FF0000'
        comparisonColor='#0000FF'
        onBecameVisible={handlePageBecameVisible}
      />
    );
  }

  // Normal page rendering
  return (
    <ViewPage
      key={pageKey}
      page={page}
      pageNumber={pageNumber}
      id={pageId}
      className={className}
      drawings={drawings.filter((d) => d.pageNumber === pageNumber)}
      onDrawingCreated={drawingCreated}
      onBecameVisible={handlePageBecameVisible}
      onDrawingClicked={onDrawingClicked}
      selectedPage={currentPage}
    />
  );
};
