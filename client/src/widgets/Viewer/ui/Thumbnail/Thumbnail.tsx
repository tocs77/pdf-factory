import { useEffect, useRef, useState } from 'react';
import { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import styles from './Thumbnail.module.scss';

// Thumbnail component for rendering a small preview of a page
interface ThumbnailProps {
  page: PDFPageProxy;
  pageNumber: number;
  isSelected: boolean;
  onClick: (pageNumber: number) => void;
  /** Quality multiplier for rendering resolution (default: 1) */
  quality?: number;
}

export const Thumbnail = ({ page, pageNumber, isSelected, onClick, quality = 1 }: ThumbnailProps) => {
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
      
      // Apply quality multiplier to canvas dimensions for higher resolution rendering
      const outputScale = window.devicePixelRatio || 1;
      const totalScale = outputScale * quality;
      
      // Set display size
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      
      // Set actual size in memory (scaled to account for device pixel ratio and quality)
      canvas.width = Math.floor(viewport.width * totalScale);
      canvas.height = Math.floor(viewport.height * totalScale);
      
      // Get context and scale it
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.scale(totalScale, totalScale);
      
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport,
      };
      
      try {
        // Create a custom render progress tracker
        const progressTracker = {
          onProgress: (progress: { loaded: number, total: number }) => {
            if (progress.total > 0) {
              const percentage = Math.round((progress.loaded / progress.total) * 100);
              setRenderProgress(percentage);
            }
          }
        };
        
        // Pass the progress tracker to the render method
        const renderTask = page.render({
          ...renderContext,
          ...progressTracker
        });
        
        // Set up progress monitoring
        renderTask.onContinue = (cont: () => void) => {
          // This ensures the progress is updated during rendering
          if (renderProgress < 90) {
            // Increment progress to show activity
            setRenderProgress(prev => Math.min(prev + 5, 90));
          }
          cont();
          return true;
        };
        
        await renderTask;
        
        // Set progress to 100% when rendering is complete
        setRenderProgress(100);
      } catch (error) {
        console.error('Error rendering thumbnail:', error);
        // Even on error, set progress to 100% to remove the loading indicator
        setRenderProgress(100);
      } finally {
        setIsRendering(false);
      }
    };
    
    renderThumbnail();
  }, [page, quality]);
  
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
          <div>Loading{renderProgress > 0 ? ` (${renderProgress}%)` : '...'}</div>
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