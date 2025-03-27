import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import classes from './Page.module.scss';
import { classNames } from '@/shared/utils';
import { DrawingComponent } from '../DrawingComponent/DrawingComponent';
import DrawRect from '../DrawRect/DrawRect';
import PinDrawingComponent from '../PinDrawingComponent/PinDrawingComponent';
import CompleteDrawings from '../CompleteDrawings/CompleteDrawings';
import { ViewerContext } from '../../model/context/viewerContext';
import { TextLayer } from '../TextLayer/TextLayer';
import { LineDrawingLayer } from '../LineDrawingLayer/LineDrawingLayer';
import { DrawAreaLayer } from '../DrawAreaLayer/DrawAreaLayer';
import { ZoomAreaLayer } from '../ZoomAreaLayer/ZoomAreaLayer';
import { TextAreaDrawingLayer } from '../TextAreaDrawingLayer/TextAreaDrawingLayer';
import { Drawing } from '../../model/types/viewerSchema';

// Page component for rendering a single PDF page
interface PageProps {
  page: PDFPageProxy;
  pageNumber: number;
  id: string;
  className?: string;
  drawings: Drawing[];
  onDrawingCreated: (drawing: Drawing) => void;
}

export const Page = ({ page, pageNumber, id, className, drawings, onDrawingCreated }: PageProps) => {
  const { state } = useContext(ViewerContext);
  const { drawingMode, pageRotations, scale } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [renderTask, setRenderTask] = useState<ReturnType<typeof page.render> | null>(null);
  const [viewport, setViewport] = useState<any>(null);

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  // Use Intersection Observer to detect when the page is visible
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setInView(entry.isIntersecting);
      },
      {
        rootMargin: '200px 0px', // Load pages 200px above and below viewport
        threshold: 0.01, // Trigger when at least 1% of the page is visible
      },
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // Only render when page is visible (or when explicitly set to visible)
  const shouldRender = inView || hasRendered;

  // Set up drawing canvas
  useEffect(() => {
    let isMounted = true;
    let currentRenderTask: ReturnType<typeof page.render> | null = null;

    const renderPage = async () => {
      // Skip rendering if the page isn't visible
      if (!canvasRef.current || !shouldRender) return;

      // If already rendered once, don't re-render
      if (hasRendered) return;

      // Create viewport with rotation
      // For 90/270 degree rotations, we need to ensure the viewport maintains the correct aspect ratio
      const currentViewport = page.getViewport({
        scale,
        rotation,
        // Enable dontFlip to ensure consistent rendering across different rotations
        dontFlip: false,
      });

      // Store the viewport in state for the TextLayer component
      setViewport(currentViewport);

      const canvas = canvasRef.current;

      // Get the parent container for proper sizing
      const parent = canvas.parentElement;
      if (!parent) {
        console.warn('Canvas parent element not found');
        return;
      }

      // Apply quality multiplier to canvas dimensions for higher resolution rendering
      const outputScale = window.devicePixelRatio || 1;
      const totalScale = outputScale;

      // Determine if we need to adjust for rotation (90 or 270 degrees)
      const isRotated90or270 = rotation === 90 || rotation === 270;

      // Set display size based on viewport dimensions
      // For 90/270 degree rotations, we need to adjust the container to maintain aspect ratio
      if (isRotated90or270) {
        // For rotated pages, we need to adjust the container size to maintain aspect ratio
        // Set the container dimensions to maintain the correct aspect ratio
        parent.style.width = `${Math.floor(currentViewport.width)}px`;
        parent.style.height = `${Math.floor(currentViewport.height)}px`;

        // Set canvas dimensions to match viewport
        canvas.style.width = `${Math.floor(currentViewport.width)}px`;
        canvas.style.height = `${Math.floor(currentViewport.height)}px`;
      } else {
        // For normal orientation, just set dimensions directly
        canvas.style.width = `${Math.floor(currentViewport.width)}px`;
        canvas.style.height = `${Math.floor(currentViewport.height)}px`;
      }

      // Set actual size in memory (scaled to account for device pixel ratio and quality)
      canvas.width = Math.floor(currentViewport.width * totalScale);
      canvas.height = Math.floor(currentViewport.height * totalScale);

      // Ensure canvasWrapper has the same dimensions as the canvas
      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.style.width = canvas.style.width;
        canvasWrapperRef.current.style.height = canvas.style.height;
      }

      // Get context and scale it
      const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
      ctx.scale(totalScale, totalScale);

      const renderContext = {
        canvasContext: ctx,
        viewport: currentViewport,
      };

      try {
        currentRenderTask = page.render(renderContext);
        setRenderTask(currentRenderTask);
        await currentRenderTask.promise;

        if (isMounted) {
          setHasRendered(true);
        }
      } catch (error: any) {
        // Don't log cancellation exceptions as errors since they're expected during rotation
        if (error.name === 'RenderingCancelledException') {
          console.debug('Rendering cancelled:', error.message);
        } else {
          console.error('Error rendering PDF page:', error);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (currentRenderTask) {
        currentRenderTask.cancel();
      }
    };
  }, [page, scale, shouldRender, hasRendered, rotation]);

  // Re-render when rotation changes
  useEffect(() => {
    // Reset hasRendered to force re-rendering when rotation changes
    setHasRendered(false);
  }, [rotation]);

  // Re-render when scale changes
  useEffect(() => {
    // Reset hasRendered to force re-rendering when scale changes
    setHasRendered(false);
  }, [scale]);

  return (
    <div ref={containerRef} className={classNames(classes.pageContainer, {}, [className])} id={id} data-page-number={pageNumber}>
      <div
        ref={pageRef}
        className={classes.page}
        style={{
          // Ensure the page container adapts to rotation
          ...(rotation === 90 || rotation === 270
            ? {
                width: 'auto',
                height: 'auto',
              }
            : {}),
        }}>
        <div
          ref={canvasWrapperRef}
          className={classes.canvasWrapper}
          style={{
            // Ensure the canvas wrapper adapts to rotation
            ...(rotation === 90 || rotation === 270
              ? {
                  width: 'auto',
                  height: 'auto',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }
              : {}),
          }}>
          <canvas ref={canvasRef} className={classes.pageCanvas} />

          {/* Text Layer - only render when text tool is selected */}
          {drawingMode === 'text' && viewport && renderTask && (
            <TextLayer
              page={page}
              viewport={viewport}
              scale={scale}
              rotation={rotation}
              renderTask={renderTask}
              pageNumber={pageNumber}
              onDrawingCreated={onDrawingCreated}
              pdfCanvasRef={canvasRef}
            />
          )}

          {/* Drawing components - only render when respective tool is selected */}
          {inView && (
            <>
              {drawingMode === 'freehand' && (
                <DrawingComponent pageNumber={pageNumber} onDrawingCreated={onDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'rectangle' && (
                <DrawRect pageNumber={pageNumber} onDrawingCreated={onDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'pin' && (
                <PinDrawingComponent pageNumber={pageNumber} onDrawingCreated={onDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'line' && (
                <LineDrawingLayer pageNumber={pageNumber} onDrawingCreated={onDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'drawArea' && (
                <DrawAreaLayer pageNumber={pageNumber} onDrawingCreated={onDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'zoomArea' && <ZoomAreaLayer pageNumber={pageNumber} />}
              {drawingMode === 'textArea' && (
                <TextAreaDrawingLayer pageNumber={pageNumber} onDrawingCreated={onDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
            </>
          )}

          {/* Always render completed drawings */}
          {inView && <CompleteDrawings pageNumber={pageNumber} drawings={drawings} />}
        </div>
      </div>
    </div>
  );
};
