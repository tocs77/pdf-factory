import { useContext, useEffect, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { Page } from '../Page/Page';
import { ViewerMenu } from '../ViewerMenu/ViewerMenu';
import { ViewerContext } from '../../model/context/viewerContext';
import { ViewerProvider } from '../../model/context/ViewerProvider';
import classes from './Viewer.module.scss';

interface PdfViewerProps {
  url: string;
  /**
   * Whether to show the thumbnail sidebar (default: true)
   */
  showThumbnails?: boolean;
  /**
   * Drawing color for annotation when text layer is disabled (default: blue)
   */
  drawingColor?: string;
  /**
   * Drawing line width for annotation (default: 2)
   */
  drawingLineWidth?: number;
}

// Internal viewer component that will be wrapped with the provider
const PdfViewerInternal = ({
  url,      
  showThumbnails = true,
}: PdfViewerProps) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, textLayerEnabled } = state;
  
  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Validate quality value
  const renderQuality = Math.max(0.5, Math.min(4, 1));

  // Use a lower quality for thumbnails to improve performance
  const thumbnailQuality = Math.max(0.5, renderQuality * 0.5);

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
    <div className={`${classes.container} ${!showThumbnails ? classes.noThumbnails : ''}`}>
      {/* Thumbnails sidebar */}
      {showThumbnails && (
        <div className={classes.thumbnailSidebar}>
          <div className={classes.thumbnailHeader}>
            <h3>Pages</h3>
            <span className={classes.pageCount}>{pages.length} pages</span>
          </div>
          {pages.map((page, index) => (
            <Thumbnail
              key={`thumb-${index + 1}`}
              page={page}
              pageNumber={index + 1}
              isSelected={selectedPage === index + 1}
              onClick={handleThumbnailClick}
              quality={thumbnailQuality}
            />
          ))}
        </div>
      )}

      {/* Main content */}
      <div className={classes.mainContent}>
        {/* Viewer Menu with zoom and drawing controls */}
        <ViewerMenu renderQuality={renderQuality} />
        
        <div className={classes.pdfContainer}>
          {pages.map((page, index) => (
            <Page
              key={`page-${index + 1}`}
              page={page}
              scale={scale}
              pageNumber={index + 1}
              id={`page-${index + 1}`}
              textLayerEnabled={textLayerEnabled}
              drawingColor={drawingColor}
              drawingLineWidth={drawingLineWidth}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Export the wrapped component with the provider
export const PdfViewer = (props: PdfViewerProps) => (
  <ViewerProvider>
    <PdfViewerInternal {...props} />
  </ViewerProvider>
);
