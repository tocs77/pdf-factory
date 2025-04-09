import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import { ViewerContext } from '../../model/context/viewerContext';
import classes from './ComparePage.module.scss';
import { classNames } from '@/shared/utils';

interface ComparePageProps {
  page: PDFPageProxy;
  pageNumber: number;
  id: string;
  className?: string;
  comparisonColor: string; // Color to tint the non-white pixels
}

// Helper function to parse hex color (e.g., #RRGGBB) to RGB
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
};

export const ComparePage = ({ page, pageNumber, id, className, comparisonColor }: ComparePageProps) => {
  const { state } = useContext(ViewerContext);
  const { pageRotations, scale } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  const rotation = pageRotations[pageNumber] || 0;

  // Use Intersection Observer to detect when the page is visible
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver((entries) => setInView(entries[0].isIntersecting), {
      rootMargin: '200px 0px',
      threshold: 0.01,
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const shouldRender = inView || hasRendered;

  // Render PDF page and process pixels
  useEffect(() => {
    let isMounted = true;
    let currentRenderTask: RenderTask | null = null;

    const processCanvasPixels = (canvas: HTMLCanvasElement, targetColor: string) => {
      const ctx = canvas.getContext('2d', { willReadFrequently: true }); // Important for performance
      if (!ctx) return;

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const targetRgb = hexToRgb(targetColor);

      if (!targetRgb) {
        console.error('Invalid comparison color provided:', targetColor);
        return;
      }

      const whiteThreshold = 245; // Pixels >= this value in R, G, B are considered white

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        // const a = data[i + 3]; // Original alpha

        // Check if pixel is white (or very close to it)
        if (r >= whiteThreshold && g >= whiteThreshold && b >= whiteThreshold) {
          // Make white pixels transparent
          data[i + 3] = 0;
        } else {
          // Tint non-white pixels with the comparison color, preserving original alpha
          data[i] = targetRgb.r;
          data[i + 1] = targetRgb.g;
          data[i + 2] = targetRgb.b;
          // data[i + 3] = a; // Keep original alpha (already set)
        }
      }
      ctx.putImageData(imageData, 0, 0);
    };

    const renderPage = async () => {
      if (!canvasRef.current || !shouldRender || hasRendered) return;

      const currentViewport = page.getViewport({ scale, rotation, dontFlip: false });
      const canvas = canvasRef.current;
      const parent = canvas.parentElement;
      if (!parent) return;

      const outputScale = window.devicePixelRatio || 1;
      const totalScale = outputScale;
      const isRotated90or270 = rotation === 90 || rotation === 270;

      if (isRotated90or270) {
        parent.style.width = `${Math.floor(currentViewport.width)}px`;
        parent.style.height = `${Math.floor(currentViewport.height)}px`;
        canvas.style.width = `${Math.floor(currentViewport.width)}px`;
        canvas.style.height = `${Math.floor(currentViewport.height)}px`;
      } else {
        canvas.style.width = `${Math.floor(currentViewport.width)}px`;
        canvas.style.height = `${Math.floor(currentViewport.height)}px`;
      }

      canvas.width = Math.floor(currentViewport.width * totalScale);
      canvas.height = Math.floor(currentViewport.height * totalScale);

      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.style.width = canvas.style.width;
        canvasWrapperRef.current.style.height = canvas.style.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(totalScale, totalScale);

      const renderContext = { canvasContext: ctx, viewport: currentViewport };

      try {
        currentRenderTask = page.render(renderContext);
        await currentRenderTask.promise;
        if (isMounted) {
          setHasRendered(true);
          // Process pixels AFTER rendering is complete
          processCanvasPixels(canvas, comparisonColor);
        }
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error('Error rendering PDF page for compare:', error);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      currentRenderTask?.cancel();
    };
  }, [page, scale, shouldRender, hasRendered, rotation, comparisonColor]);

  // Reset rendering state on rotation/scale change
  useEffect(() => setHasRendered(false), [rotation, scale]);

  return (
    <div ref={containerRef} className={classNames(classes.pageContainer, {}, [className])} id={id} data-page-number={pageNumber}>
      <div
        ref={pageRef}
        className={classes.page}
        style={{
          ...(rotation === 90 || rotation === 270 ? { width: 'auto', height: 'auto' } : {}),
        }}>
        <div
          ref={canvasWrapperRef}
          className={classes.canvasWrapper}
          style={{
            ...(rotation === 90 || rotation === 270
              ? { width: 'auto', height: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center' }
              : {}),
          }}>
          {/* Only render the canvas, no drawing or text layers */}
          <canvas ref={canvasRef} className={classes.pageCanvas} />
        </div>
      </div>
    </div>
  );
};
