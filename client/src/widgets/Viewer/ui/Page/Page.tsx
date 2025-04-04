import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist/types/src/display/api';
import classes from './Page.module.scss';
import { classNames } from '@/shared/utils';
import CompleteDrawings from '../CompleteDrawings/CompleteDrawings';
import { ViewerContext } from '../../model/context/viewerContext';
import { TextLayer } from '../TextLayer/TextLayer';
import { DrawAreaLayer } from '../DrawAreaLayer/DrawAreaLayer';
import { ZoomAreaLayer } from '../ZoomAreaLayer/ZoomAreaLayer';
import { RulerDrawingLayer } from '../RulerDrawingLayer/RulerDrawingLayer';
import { Drawing } from '../../model/types/viewerSchema';
import { DraftLayer } from '../DraftLayer/DraftLayer';

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
  const { drawingMode, pageRotations, scale, isDraftDrawing } = state;

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

  const handleDrawingCreated = (drawing: Omit<Drawing, 'id'>) => {
    // Calculate bounding box for the drawing based on its type
    const boundingBox = calculateBoundingBox(drawing);

    // Add bounding box to the drawing
    const drawingWithBoundingBox = {
      ...drawing,
      boundingBox,
    };

    // Call the parent's onDrawingCreated with the enhanced drawing
    if (onDrawingCreated) {
      // Use type assertion to handle the Drawing union type
      onDrawingCreated(drawingWithBoundingBox as any);
    }
  };

  // Function to calculate bounding box based on drawing type
  const calculateBoundingBox = (drawing: Omit<Drawing, 'id'>): { top: number; left: number; right: number; bottom: number } => {
    switch (drawing.type) {
      case 'rectangle':
      case 'drawArea':
      case 'textArea': {
        // For rectangle-based drawings
        const rectDrawing = drawing as any;
        return {
          top: Math.min(rectDrawing.startPoint.y, rectDrawing.endPoint.y),
          left: Math.min(rectDrawing.startPoint.x, rectDrawing.endPoint.x),
          right: Math.max(rectDrawing.startPoint.x, rectDrawing.endPoint.x),
          bottom: Math.max(rectDrawing.startPoint.y, rectDrawing.endPoint.y),
        };
      }

      case 'pin': {
        // For pins, create a small area around the pin position
        const pinDrawing = drawing as any;
        return {
          top: pinDrawing.position.y - 10,
          left: pinDrawing.position.x - 10,
          right: pinDrawing.position.x + 10,
          bottom: pinDrawing.position.y + 10,
        };
      }

      case 'line': {
        // For line drawings, calculate min/max of all line points
        let minX = Infinity,
          minY = Infinity,
          maxX = -Infinity,
          maxY = -Infinity;

        const lineDrawing = drawing as any;
        lineDrawing.lines.forEach((line: any) => {
          minX = Math.min(minX, line.startPoint.x, line.endPoint.x);
          minY = Math.min(minY, line.startPoint.y, line.endPoint.y);
          maxX = Math.max(maxX, line.startPoint.x, line.endPoint.x);
          maxY = Math.max(maxY, line.startPoint.y, line.endPoint.y);
        });

        return {
          top: minY,
          left: minX,
          right: maxX,
          bottom: maxY,
        };
      }

      case 'freehand': {
        // For freehand drawings, calculate min/max of all path points
        let minPathX = Infinity,
          minPathY = Infinity,
          maxPathX = -Infinity,
          maxPathY = -Infinity;

        const freehandDrawing = drawing as any;
        freehandDrawing.paths.forEach((path: any) => {
          path.forEach((point: any) => {
            minPathX = Math.min(minPathX, point.x);
            minPathY = Math.min(minPathY, point.y);
            maxPathX = Math.max(maxPathX, point.x);
            maxPathY = Math.max(maxPathY, point.y);
          });
        });

        return {
          top: minPathY,
          left: minPathX,
          right: maxPathX,
          bottom: maxPathY,
        };
      }

      case 'textUnderline':
      case 'textCrossedOut': {
        // For text underlines and cross-outs, calculate min/max of all lines
        let minLineX = Infinity,
          minLineY = Infinity,
          maxLineX = -Infinity,
          maxLineY = -Infinity;

        const lineTextDrawing = drawing as any;
        lineTextDrawing.lines.forEach((line: any) => {
          minLineX = Math.min(minLineX, line.start.x, line.end.x);
          minLineY = Math.min(minLineY, line.start.y, line.end.y);
          maxLineX = Math.max(maxLineX, line.start.x, line.end.x);
          maxLineY = Math.max(maxLineY, line.start.y, line.end.y);
        });

        return {
          top: minLineY,
          left: minLineX,
          right: maxLineX,
          bottom: maxLineY,
        };
      }

      case 'textHighlight': {
        // For text highlights, calculate min/max of all rectangles
        let minRectX = Infinity,
          minRectY = Infinity,
          maxRectX = -Infinity,
          maxRectY = -Infinity;

        const highlightDrawing = drawing as any;
        highlightDrawing.rects.forEach((rect: any) => {
          minRectX = Math.min(minRectX, rect.x);
          minRectY = Math.min(minRectY, rect.y);
          maxRectX = Math.max(maxRectX, rect.x + rect.width);
          maxRectY = Math.max(maxRectY, rect.y + rect.height);
        });

        return {
          top: minRectY,
          left: minRectX,
          right: maxRectX,
          bottom: maxRectY,
        };
      }

      default:
        // Default fallback - create a reasonable default bounding box
        return {
          top: 0,
          left: 0,
          right: 100,
          bottom: 100,
        };
    }
  };

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
              onDrawingCreated={handleDrawingCreated}
              pdfCanvasRef={canvasRef}
            />
          )}

          {/* Drawing components - only render when respective tool is selected */}
          {inView && (
            <>
              {isDraftDrawing && (
                <DraftLayer pageNumber={pageNumber} onDrawingCreated={handleDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'drawArea' && (
                <DrawAreaLayer pageNumber={pageNumber} onDrawingCreated={handleDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'zoomArea' && <ZoomAreaLayer pageNumber={pageNumber} />}

              {drawingMode === 'ruler' && <RulerDrawingLayer pageNumber={pageNumber} pdfCanvasRef={canvasRef} />}
            </>
          )}

          {/* Always render completed drawings */}
          {inView && <CompleteDrawings pageNumber={pageNumber} drawings={drawings} />}
        </div>
      </div>
    </div>
  );
};
