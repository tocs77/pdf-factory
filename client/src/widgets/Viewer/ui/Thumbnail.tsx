import { useEffect, useRef, useState } from 'react';
import { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import styles from './Thumbnail/Thumbnail.module.scss';

// Thumbnail component for rendering a small preview of a page
interface ThumbnailProps {
  page: PDFPageProxy;
  pageNumber: number;
  isSelected: boolean;
  onClick: (pageNumber: number) => void;
}

export const Thumbnail = ({ page, pageNumber, isSelected, onClick }: ThumbnailProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderProgress, setRenderProgress] = useState(0);
  
  useEffect(() => {
    const renderThumbnail = async () => {
      if (!canvasRef.current) return;
      
      setIsRendering(true);
      setRenderProgress(0);
      
      // Use a smaller scale for thumbnails
      const viewport = page.getViewport({ scale: 0.2 });
      const canvas = canvasRef.current;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      const renderContext = {
        canvasContext: canvas.getContext('2d') as CanvasRenderingContext2D,
        viewport: viewport,
      };
      
      try {
        // Create a custom render progress tracker
        const progressTracker = {
          onRenderProgress: (progress: { loaded?: number, total?: number }) => {
            if (progress.total && progress.loaded !== undefined) {
              const percentage = Math.round((progress.loaded / progress.total) * 100);
              setRenderProgress(percentage);
            }
          }
        };
        
        // Pass the progress tracker to the render method
        await page.render({
          ...renderContext,
          ...progressTracker
        });
      } catch (error) {
        console.error('Error rendering thumbnail:', error);
      } finally {
        setRenderProgress(100);
        setIsRendering(false);
      }
    };
    
    renderThumbnail();
  }, [page]);
  
  return (
    <div 
      className={`${styles.thumbnail} ${isSelected ? styles.selected : ''}`} 
      onClick={() => onClick(pageNumber)}
    >
      <div className={styles.pageNumber}>
        Page {pageNumber}
      </div>
      <canvas ref={canvasRef}></canvas>
      
      {isRendering && (
        <div className={styles.renderingOverlay}>
          <div>Loading...</div>
          <div className={styles.progressText}>{renderProgress}%</div>
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${renderProgress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
}; 