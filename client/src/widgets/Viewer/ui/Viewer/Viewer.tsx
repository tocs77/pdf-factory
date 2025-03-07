import { useContext, useEffect, useState, useRef, useCallback } from 'react';
import * as pdfjs from 'pdfjs-dist';
import { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import { Thumbnail } from '../Thumbnail/Thumbnail';
import { Page } from '../Page/Page';
import { ViewerMenu } from '../ViewerMenu/ViewerMenu';
import { ViewerContext } from '../../model/context/viewerContext';
import { ViewerProvider } from '../../model/context/ViewerProvider';
import { classNames } from '@/shared/utils';
import classes from './Viewer.module.scss';

interface PdfViewerProps {
  url: string;
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
const PdfViewerInternal = ({ url }: PdfViewerProps) => {
  const { state } = useContext(ViewerContext);
  const { scale, showThumbnails } = state;

  const [pdfRef, setPdfRef] = useState<PDFDocumentProxy | null>(null);
  const [pages, setPages] = useState<PDFPageProxy[]>([]);
  const [selectedPage, setSelectedPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);
  const prevScaleRef = useRef<number>(scale);

  // Validate quality value
  const renderQuality = Math.max(0.5, Math.min(4, 1));

  // Use a lower quality for thumbnails to improve performance
  const thumbnailQuality = Math.max(0.5, renderQuality * 0.5);

  // Find the page element that's most visible in the viewport
  const findVisiblePageElement = useCallback(() => {
    if (!pdfContainerRef.current) return null;

    const container = pdfContainerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Get all page elements
    const pageElements = Array.from(container.querySelectorAll('[data-page-number]'));
    let bestVisiblePage = null;
    let bestVisibleArea = 0;

    for (const pageEl of pageElements) {
      const pageRect = pageEl.getBoundingClientRect();

      // Calculate how much of the page is visible in the viewport
      const visibleTop = Math.max(pageRect.top, containerRect.top);
      const visibleBottom = Math.min(pageRect.bottom, containerRect.bottom);

      if (visibleBottom > visibleTop) {
        const visibleArea = visibleBottom - visibleTop;

        if (visibleArea > bestVisibleArea) {
          bestVisibleArea = visibleArea;
          bestVisiblePage = pageEl;
        }
      }
    }

    return bestVisiblePage;
  }, []);

  // Preserve scroll position when scale changes
  useEffect(() => {
    if (!pdfContainerRef.current || prevScaleRef.current === scale) return;

    const container = pdfContainerRef.current;

    // Find the most visible page and its relative position
    const visiblePage = findVisiblePageElement();

    if (!visiblePage) {
      // Fallback to simple ratio-based scrolling if no visible page found
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const containerHeight = container.clientHeight;
      const scrollRatio = scrollTop / (scrollHeight - containerHeight);

      console.log(`No visible page found. Using ratio: ${scrollRatio}`);

      // Update scale reference
      prevScaleRef.current = scale;

      // Apply new scroll position after DOM update
      setTimeout(() => {
        if (!container) return;
        const newScrollHeight = container.scrollHeight;
        const newContainerHeight = container.clientHeight;
        const newScrollTop = scrollRatio * (newScrollHeight - newContainerHeight);
        container.scrollTop = newScrollTop;
      }, 100);

      return;
    }

    // Get page number and position data
    const pageNumber = parseInt((visiblePage as Element).getAttribute('data-page-number') || '1', 10);
    const pageRect = (visiblePage as Element).getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate the relative position of the page within the viewport
    const relativePositionInViewport = (pageRect.top + pageRect.height / 2 - containerRect.top) / containerRect.height;

    // Update scale reference
    prevScaleRef.current = scale;

    // Wait for the DOM to update with the new scale
    setTimeout(() => {
      if (!container) return;

      // Find the same page after scaling
      const newPageElements = container.querySelectorAll('[data-page-number]');
      let targetPage: Element | null = null;

      for (let i = 0; i < newPageElements.length; i++) {
        const el = newPageElements[i];
        const elPageNumber = parseInt(el.getAttribute('data-page-number') || '0', 10);

        if (elPageNumber === pageNumber) {
          targetPage = el;
          break;
        }
      }

      if (!targetPage) {
        console.warn(`Could not find page ${pageNumber} after scaling`);
        return;
      }

      // Calculate new scroll position to maintain the same relative position
      const newPageRect = targetPage.getBoundingClientRect();
      const newContainerRect = container.getBoundingClientRect();

      // Calculate the target scroll position
      const targetScrollTop =
        container.scrollTop +
        (newPageRect.top - newContainerRect.top) +
        newPageRect.height * relativePositionInViewport -
        containerRect.height * relativePositionInViewport;

      // Apply the new scroll position
      container.scrollTop = targetScrollTop;

      console.log(`New scroll position set to ${targetScrollTop.toFixed(2)}px`);
    }, 100); // Small delay to ensure the DOM has updated
  }, [scale]);

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

  // Update current page on scroll - this effect sets up the scroll handler
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const visiblePage = findVisiblePageElement();
      
      if (visiblePage) {
        const pageNumberAttr = visiblePage.getAttribute('data-page-number');
        if (pageNumberAttr) {
          const pageNumber = parseInt(pageNumberAttr, 10);
          if (pageNumber !== selectedPage) {
            setSelectedPage(pageNumber);
          }
        }
      }
    };

    // Add the scroll event listener
    container.addEventListener('scroll', handleScroll);
    
    // Run the handler once to set the initial page
    handleScroll();
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [selectedPage, pages.length, findVisiblePageElement]);

  // Additional effect to update the current page when the container becomes available
  // or when pages are loaded
  useEffect(() => {
    const container = pdfContainerRef.current;
    if (!container || pages.length === 0) return;
    
    // Find the most visible page and update selectedPage
    const visiblePage = findVisiblePageElement();
    if (visiblePage) {
      const pageNumberAttr = visiblePage.getAttribute('data-page-number');
      if (pageNumberAttr) {
        const pageNumber = parseInt(pageNumberAttr, 10);
        setSelectedPage(pageNumber);
      }
    } else {
      // If no page is visible yet, default to page 1
      setSelectedPage(1);
    }
  }, [pages.length, findVisiblePageElement]);

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
    <div className={classNames(classes.container, { [classes.noThumbnails]: !showThumbnails }, [])}>
      {showThumbnails && (
        <div className={classes.thumbnailsContainer}>
          {pages.map((page, index) => (
            <Thumbnail
              key={index + 1}
              page={page}
              pageNumber={index + 1}
              quality={thumbnailQuality}
              isSelected={selectedPage === index + 1}
              onClick={handleThumbnailClick}
            />
          ))}
        </div>
      )}

      <div className={classes.viewerContainer}>
        <ViewerMenu renderQuality={renderQuality} currentPage={selectedPage} totalPages={pages.length} />

        <div className={classes.pdfContainer} ref={pdfContainerRef}>
          <div className={classes.pdfContentWrapper}>
            {pages.map((page, index) => (
              <Page key={index + 1} page={page} scale={scale} pageNumber={index + 1} id={`page-${index + 1}`} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Wrap the internal component with the provider
export const PdfViewer = (props: PdfViewerProps) => (
  <ViewerProvider>
    <PdfViewerInternal {...props} />
  </ViewerProvider>
);
