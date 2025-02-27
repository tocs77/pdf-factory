import { useEffect, useRef, useState } from 'react';
import { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import styles from './Page.module.scss';

// Page component for rendering a single PDF page
interface PageProps {
  page: PDFPageProxy;
  scale: number;
  pageNumber: number;
  id: string;
  /** Quality multiplier for rendering resolution (default: 1) */
  quality?: number;
}

export const Page = ({ page, scale, pageNumber, id, quality = 1 }: PageProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderProgress, setRenderProgress] = useState(0);

  useEffect(() => {
    const renderPage = async () => {
      if (!canvasRef.current) return;

      setIsRendering(true);
      setRenderProgress(0);

      const viewport = page.getViewport({ scale });
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
          onRenderProgress: (progress: { loaded?: number; total?: number }) => {
            if (progress.total && progress.loaded !== undefined) {
              const percentage = Math.round((progress.loaded / progress.total) * 100);
              setRenderProgress(percentage);
            }
          },
        };

        // Pass the progress tracker to the render method
        await page.render({
          ...renderContext,
          ...progressTracker,
        });
      } catch (error) {
        console.error('Error rendering PDF page:', error);
      } finally {
        setRenderProgress(100);
        setIsRendering(false);
      }
    };

    renderPage();
  }, [page, scale, quality]);

  return (
    <div id={id} className={styles.pageContainer}>
      <div className={styles.pageInfo}>
        Page {pageNumber} ({Math.round(page.view[2])} × {Math.round(page.view[3])} px)
        {quality > 1 && <span> - {quality}x quality</span>}
      </div>
      <canvas ref={canvasRef}></canvas>

      {isRendering && (
        <div className={styles.renderingOverlay}>
          <div>Rendering...</div>
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
