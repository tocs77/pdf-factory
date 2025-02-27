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
}

export const PdfViewer = ({ url, quality = 1 }: PdfViewerProps) => {
  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [scale, setScale] = useState(1.5);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading PDF...');
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

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
          })
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
          onProgress: progressCallback
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
            <div className={styles.loadingTitle}>
              {loadingMessage}
            </div>
            <div className={styles.loadingPercentage}>
              {loadingProgress}%
            </div>
            <div className={styles.progressBar}>
              <div 
                className={styles.progressFill} 
                style={{ width: `${loadingProgress}%` }}
              ></div>
            </div>
            <div className={styles.spinner}></div>
          </div>
        ) : (
          <div className={styles.errorBox}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Thumbnails sidebar */}
      <div className={styles.thumbnailSidebar}>
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
            />
          ))}
        </div>
      </div>
    </div>
  );
};
