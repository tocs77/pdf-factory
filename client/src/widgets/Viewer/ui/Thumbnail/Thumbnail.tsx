import { useEffect, useRef, useState } from 'react';
import { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import styles from './Thumbnail.module.scss';

// Thumbnail component for rendering a small preview of a page
interface ThumbnailProps {
  page: PDFPageProxy;
  pageNumber: number;
  isSelected: boolean;
  onClick: (pageNumber: number) => void;
}

export const Thumbnail = (props: ThumbnailProps) => {
  const { page, pageNumber, isSelected, onClick } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);

  // Set up Intersection Observer to detect when thumbnail is visible
  useEffect(() => {
    if (!containerRef.current) return;

    const options = {
      root: null, // viewport
      rootMargin: '100px', // start loading slightly before it comes into view
      threshold: 0.1, // trigger when at least 10% of the element is visible
    };

    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      setIsVisible(entry.isIntersecting);
    }, options);

    observer.observe(containerRef.current);

    return () => {
      if (containerRef.current) {
        observer.unobserve(containerRef.current);
      }
    };
  }, []);

  // Render thumbnail when it becomes visible
  useEffect(() => {
    if (!page || !canvasRef.current || !isVisible) return;
    if (hasRendered) return;

    const renderThumbnail = async () => {
      try {
        setIsRendering(true);

        const canvas = canvasRef.current;
        if (!canvas) return;

        // Get container dimensions
        const containerWidth = 110; // Slightly less than the 120px container width
        const containerHeight = 130; // From CSS

        // Get default viewport at scale 1
        const defaultViewport = page.getViewport({ scale: 1, rotation: 0 });

        // Calculate scale to fit within container
        const scaleX = containerWidth / defaultViewport.width;
        const scaleY = containerHeight / defaultViewport.height;
        const scale = Math.min(scaleX, scaleY) * 0.95; // 5% margin

        // Create viewport with calculated scale
        const viewport = page.getViewport({
          scale,
          rotation: 0,
        });

        // Set canvas dimensions
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        // Get context and ensure it's not null
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.error('Could not get canvas context for thumbnail');
          return;
        }

        // Render page
        const renderContext = {
          canvasContext: ctx,
          viewport,
        };

        await page.render(renderContext).promise;
        setHasRendered(true);
      } catch (error) {
        console.error('Error rendering thumbnail:', error);
      } finally {
        setIsRendering(false);
      }
    };

    renderThumbnail();
  }, [page, isVisible, hasRendered]);

  return (
    <div
      ref={containerRef}
      className={`${styles.thumbnail} ${isSelected ? styles.selected : ''}`}
      onClick={() => onClick(pageNumber)}>
      <div className={styles.pageNumber}>Page {pageNumber}</div>
      <canvas ref={canvasRef}></canvas>

      {!hasRendered && isVisible && (
        <div className={styles.placeholderOverlay}>
          <div>Loading...</div>
        </div>
      )}

      {isRendering && (
        <div className={styles.renderingOverlay}>
          <div>Loading...</div>
        </div>
      )}
    </div>
  );
};
