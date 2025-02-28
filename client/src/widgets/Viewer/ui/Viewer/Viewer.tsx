import { useEffect, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { Page } from '../Page/Page';
import classes from './Viewer.module.scss';

// Define the progress callback type
interface OnProgressParameters {
  loaded: number;
  total: number;
}
const MAX_ZOOM = 10;
interface PdfViewerProps {
  url: string;
  /**
   * Quality multiplier for rendering resolution (default: 1)
   * Higher values improve quality but may impact performance
   * Recommended values: 1-3
   */
  quality?: number;
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

export const PdfViewer = ({
  url,
  quality = 1,
  showThumbnails = true,
  drawingColor = '#2196f3',
  drawingLineWidth = 2,
}: PdfViewerProps) => {
  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.5);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading PDF...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [textLayerEnabled, setTextLayerEnabled] = useState(true);
  const [currentDrawingColor, setCurrentDrawingColor] = useState(drawingColor);
  const [currentLineWidth, setCurrentLineWidth] = useState(drawingLineWidth);

  // Validate quality value
  const renderQuality = Math.max(0.5, Math.min(4, quality));

  // Use a lower quality for thumbnails to improve performance
  const thumbnailQuality = Math.max(0.5, renderQuality * 0.5);

  // Load all pages when PDF is loaded
  useEffect(() => {
    const loadPages = async () => {
      if (!pdfRef) return;

      try {
        setLoadingMessage('Loading pages...');
        setLoadingProgress(0);

        const pagesPromises = [];
        for (let i = 1; i <= pdfRef.numPages; i++) {
          pagesPromises.push(pdfRef.getPage(i));
        }

        // Track progress of loading pages
        const totalPages = pdfRef.numPages;
        let loadedPages = 0;

        const loadedPagesArray = await Promise.all(
          pagesPromises.map(async (pagePromise) => {
            const page = await pagePromise;
            loadedPages++;
            setLoadingProgress(Math.round((loadedPages / totalPages) * 100));
            return page;
          }),
        );

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
        setLoadingMessage('Loading PDF document...');
        setLoadingProgress(0);
        setError(null);

        // Create a progress callback
        const progressCallback = (data: OnProgressParameters) => {
          if (data.total > 0) {
            const percentage = Math.round((data.loaded / data.total) * 100);
            setLoadingProgress(percentage);
          }
        };

        // Use the documented API for loading with progress
        const loadingTask = pdfjs.getDocument({
          url: url,
          // @ts-ignore - The type definitions are incomplete, but this is the correct API
          onProgress: progressCallback,
        });

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

  const zoomIn = () => {
    setScale((prevScale) => Math.min(prevScale + 0.25, MAX_ZOOM));
  };

  const zoomOut = () => {
    setScale((prevScale) => Math.max(prevScale - 0.25, 0.5));
  };

  const resetZoom = () => {
    setScale(1.5);
  };

  const toggleTextLayer = () => {
    setTextLayerEnabled((prev) => !prev);
  };

  // Change drawing color
  const changeDrawingColor = (color: string) => {
    setCurrentDrawingColor(color);
  };

  // Change line width
  const changeLineWidth = (width: number) => {
    setCurrentLineWidth(width);
  };

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
            <div className={classes.loadingTitle}>{loadingMessage}</div>
            <div className={classes.loadingPercentage}>{loadingProgress}%</div>
            <div className={classes.progressBar}>
              <div className={classes.progressFill} style={{ width: `${loadingProgress}%` }}></div>
            </div>
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
        <div className={classes.zoomControls}>
          <button onClick={zoomOut} className={classes.zoomButton}>
            Zoom Out
          </button>
          <button onClick={resetZoom} className={classes.zoomButton}>
            Reset Zoom
          </button>
          <button onClick={zoomIn}>Zoom In</button>
          <span className={classes.zoomPercentage}>
            {Math.round(scale * 100)}% {renderQuality > 1 && `(${renderQuality}x quality)`}
          </span>
          <div className={classes.featureInfo}>
            <button
              onClick={toggleTextLayer}
              className={`${classes.textLayerToggle} ${textLayerEnabled ? classes.active : ''}`}
              title={textLayerEnabled ? 'Switch to drawing mode' : 'Switch to text selection mode'}>
              {textLayerEnabled ? (
                <>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'>
                    <path d='M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7'></path>
                    <path d='M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z'></path>
                  </svg>
                  <span>Switch to Drawing Mode</span>
                </>
              ) : (
                <>
                  <svg
                    xmlns='http://www.w3.org/2000/svg'
                    width='16'
                    height='16'
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'>
                    <path d='M17 8h3a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3'></path>
                    <path d='M7 8H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h3'></path>
                    <line x1='12' y1='2' x2='12' y2='22'></line>
                  </svg>
                  <span>Switch to Text Selection</span>
                </>
              )}
            </button>

            {!textLayerEnabled && (
              <div className={classes.drawingControls}>
                <div className={classes.colorPicker}>
                  {['#2196f3', '#4caf50', '#f44336', '#ff9800', '#9c27b0'].map((color) => (
                    <button
                      key={color} 
                      className={`${classes.colorButton} ${currentDrawingColor === color ? classes.active : ''}`}
                      style={{ backgroundColor: color }}
                      onClick={() => changeDrawingColor(color)}
                      title={`Change drawing color to ${color}`}
                    />
                  ))}
                </div>
                <div className={classes.lineWidthControls}>
                  <button
                    className={`${classes.lineWidthButton} ${currentLineWidth === 1 ? classes.active : ''}`}
                    onClick={() => changeLineWidth(1)}
                    title='Thin line'>
                    <div className={classes.linePreview} style={{ height: '1px' }}></div>
                  </button>
                  <button
                    className={`${classes.lineWidthButton} ${currentLineWidth === 2 ? classes.active : ''}`}
                    onClick={() => changeLineWidth(2)}
                    title='Medium line'>
                    <div className={classes.linePreview} style={{ height: '2px' }}></div>
                  </button>
                  <button
                    className={`${classes.lineWidthButton} ${currentLineWidth === 4 ? classes.active : ''}`}
                    onClick={() => changeLineWidth(4)}
                    title='Thick line'>
                    <div className={classes.linePreview} style={{ height: '4px' }}></div>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className={classes.pdfContainer}>
          {pages.map((page, index) => (
            <Page
              key={`page-${index + 1}`}
              page={page}
              scale={scale}
              pageNumber={index + 1}
              id={`page-${index + 1}`}
              quality={renderQuality}
              textLayerEnabled={textLayerEnabled}
              drawingColor={currentDrawingColor}
              drawingLineWidth={currentLineWidth}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
