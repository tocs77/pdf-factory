import { PDFPageProxy } from 'pdfjs-dist';

import { ViewPage } from '../ViewPage/ViewPage';
import { ComparePageDiff } from '../ComparePageDiff/ComparePageDiff';
import { ComparePageSideBySide } from '../ComparePageSideBySide/ComparePageSideBySide';
import { Drawing } from '../../model/types/viewerSchema';

interface PageProps {
  page: PDFPageProxy;
  pageNumber: number;
  compareMode?: 'sideBySide' | 'diff' | 'none';
  comparePage?: PDFPageProxy | null;
  drawings: Drawing[];
  drawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
  onBecameVisible: (pageNumber: number) => void;
  onDrawingClicked?: (id: string) => void;
  className?: string;
  selectedPage: number;
}

export const Page = (props: PageProps) => {
  const {
    page,
    pageNumber,
    compareMode = 'none',
    comparePage = null,
    drawings,
    drawingCreated,
    onBecameVisible,
    onDrawingClicked,
    className,
    selectedPage,
  } = props;

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
        onBecameVisible={onBecameVisible}
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
        onBecameVisible={onBecameVisible}
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
      onBecameVisible={onBecameVisible}
      onDrawingClicked={onDrawingClicked}
      selectedPage={selectedPage}
    />
  );
};
