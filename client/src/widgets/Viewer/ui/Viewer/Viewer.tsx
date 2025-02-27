import { useEffect, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { Page } from '../Page/Page';
import styles from './Viewer.module.scss';

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
}

export const PdfViewer = ({ url, quality = 1, showThumbnails = true }: PdfViewerProps) => {
  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.5);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading PDF...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [textLayerEnabled, setTextLayerEnabled] = useState(true);

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
    setTextLayerEnabled(prev => !prev);
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
      <div className={styles.loadingContainer}>
        {isLoading ? (
          <div className={styles.loadingBox}>
            <div className={styles.loadingTitle}>{loadingMessage}</div>
            <div className={styles.loadingPercentage}>{loadingProgress}%</div>
            <div className={styles.progressBar}>
              <div className={styles.progressFill} style={{ width: `${loadingProgress}%` }}></div>
            </div>
            <div className={styles.spinner}></div>
          </div>
        ) : (
          <div className={styles.errorBox}>{error}</div>
        )}
      </div>
    );
  }

  return (
    <div className={`${styles.container} ${!showThumbnails ? styles.noThumbnails : ''}`}>
      {/* Thumbnails sidebar */}
      {showThumbnails && (
        <div className={styles.thumbnailSidebar}>
          <div className={styles.thumbnailHeader}>
            <h3>Pages</h3>
            <span className={styles.pageCount}>{pages.length} pages</span>
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
      <div className={styles.mainContent}>
        <div className={styles.zoomControls}>
          <button onClick={zoomOut} className={styles.zoomButton}>
            Zoom Out
          </button>
          <button onClick={resetZoom} className={styles.zoomButton}>
            Reset Zoom
          </button>
          <button onClick={zoomIn}>Zoom In</button>
          <span className={styles.zoomPercentage}>
            {Math.round(scale * 100)}% {renderQuality > 1 && `(${renderQuality}x quality)`}
          </span>
          <div className={styles.featureInfo}>
            <button 
              onClick={toggleTextLayer} 
              className={`${styles.textLayerToggle} ${textLayerEnabled ? styles.active : ''}`}
              title={textLayerEnabled ? "Disable text selection" : "Enable text selection"}
            >
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
              <span>Text selection {textLayerEnabled ? 'enabled' : 'disabled'}</span>
            </button>
          </div>
        </div>
        <div className="pdf-container">
          {pages.map((page, index) => (
            <Page
              key={`page-${index + 1}`}
              page={page}
              scale={scale}
              pageNumber={index + 1}
              id={`page-${index + 1}`}
              quality={renderQuality}
              textLayerEnabled={textLayerEnabled}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
