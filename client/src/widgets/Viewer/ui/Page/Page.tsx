import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
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
import RectSelectionDrawingComponent from '../RectSelectionDrawingComponent/RectSelectionDrawingComponent';
import PinSelectionDrawingComponent from '../PinSelectionDrawingComponent/PinSelectionDrawingComponent';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';

// Page component for rendering a single PDF page
interface PageProps {
  onBecameVisible?: (pageNumber: number) => void;
  page: PDFPageProxy;
  pageNumber: number;
  id: string;
  className?: string;
  drawings: Drawing[];
  onDrawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
  onDrawingClicked?: (id: string) => void;
}

export const Page = ({
  page,
  pageNumber,
  id,
  className,
  drawings,
  onDrawingCreated,
  onBecameVisible,
  onDrawingClicked,
}: PageProps) => {
  const { state } = useContext(ViewerContext);
  const { drawingMode, pageRotations, scale, currentDrawingPage } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [renderTask, setRenderTask] = useState<ReturnType<typeof page.render> | null>(null);
  const [viewport, setViewport] = useState<any>(null);

  // Track drag state to prevent drawing clicks after drag
  const isDraggingRef = useRef(false);
  const mouseDownPosRef = useRef({ x: 0, y: 0 });
  const dragThreshold = 5; // Pixels of movement to consider a drag

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  // Handle mouse down to detect potential drag operations
  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only track when drawingMode is 'none' (same condition as click handling)
    if (drawingMode !== 'none') return;

    // Store mouse down position
    mouseDownPosRef.current = { x: event.clientX, y: event.clientY };

    // Reset dragging state at the start of a potential new drag
    isDraggingRef.current = false;

    // Add temporary event listeners to track movement
    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Calculate distance moved from mouse down
      const dx = moveEvent.clientX - mouseDownPosRef.current.x;
      const dy = moveEvent.clientY - mouseDownPosRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If moved more than threshold, consider it a drag
      if (distance > dragThreshold) {
        isDraggingRef.current = true;
      }
    };

    const handleMouseUp = () => {
      // Clean up event listeners
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    // Add listeners to window to catch events outside the element
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Function to handle canvas click
  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only proceed if drawing mode is 'none' and canvas ref is available
    if (drawingMode !== 'none' || !canvasRef.current) return;

    // Skip if no onDrawingClicked handler is provided
    if (!onDrawingClicked) return;

    // If a drag was detected, don't process the click
    if (isDraggingRef.current) {
      return;
    }

    // Get canvas position and dimensions
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Calculate click position relative to canvas
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Normalize coordinates to account for rotation and scale
    const normalizedPoint = normalizeCoordinatesToZeroRotation({ x, y }, canvas.width, canvas.height, scale, rotation);

    // Check if click is inside any drawing's bounding box
    for (const drawing of drawings) {
      if (drawing.boundingBox && drawing.pageNumber === pageNumber) {
        const { left, right, top, bottom } = drawing.boundingBox;

        // Compare with normalized coordinates
        if (normalizedPoint.x >= left && normalizedPoint.x <= right && normalizedPoint.y >= top && normalizedPoint.y <= bottom) {
          // Make sure drawing.id is defined before passing to handler
          if (drawing.id) {
            // Use a type-safe approach with a local function
            const handleDrawingClick = onDrawingClicked as (id: string) => void;
            handleDrawingClick(drawing.id);
          }
          // Stop event propagation to prevent interference with drag-to-scroll
          event.stopPropagation();
          return;
        }
      }
    }
  };

  // Use Intersection Observer to detect when the page is visible
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Check if intersecting and if the intersection ratio meets the threshold
        const isNowVisible = entry.isIntersecting && entry.intersectionRatio >= 0.1;

        // Only update state if visibility actually changed to prevent unnecessary re-renders
        if (isNowVisible !== inView) {
          setInView(isNowVisible);
        }
      },
      {
        rootMargin: '200px 0px', // Keep pre-rendering margin
        threshold: 0.1, // Trigger when 10% of the target is visible
      },
    );

    const currentContainer = containerRef.current; // Capture ref value
    if (currentContainer) {
      observer.observe(currentContainer);
    }

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
    };
    // Depend on inView to re-evaluate if needed (though the observer itself handles changes)
  }, [inView]);

  // Effect to notify parent when visibility changes
  useEffect(() => {
    // Only notify if in view (based on the 10% threshold) AND has rendered its content
    if (inView && hasRendered && onBecameVisible) {
      onBecameVisible(pageNumber);
    }
    // Depend on the refined inView state, hasRendered, and the callback itself
  }, [inView, hasRendered, pageNumber, onBecameVisible]);

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
    // Call the parent's onDrawingCreated with the enhanced drawing
    if (onDrawingCreated) {
      // Use type assertion to handle the Drawing union type
      onDrawingCreated(drawing);
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
          }}
          onMouseDown={handleMouseDown}
          onClick={handleCanvasClick}>
          <canvas ref={canvasRef} className={classes.pageCanvas} />

          {/* Text Layer - only render when text tool is selected */}
          {(drawingMode === 'textUnderline' || drawingMode === 'textCrossedOut' || drawingMode === 'textHighlight') &&
            viewport &&
            renderTask && (
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
              {(currentDrawingPage === 0 || currentDrawingPage === pageNumber) && (
                <DraftLayer pageNumber={pageNumber} onDrawingCreated={handleDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'drawArea' && (
                <DrawAreaLayer pageNumber={pageNumber} onDrawingCreated={handleDrawingCreated} pdfCanvasRef={canvasRef} />
              )}
              {drawingMode === 'zoomArea' && <ZoomAreaLayer pageNumber={pageNumber} />}

              {drawingMode === 'ruler' && <RulerDrawingLayer pageNumber={pageNumber} pdfCanvasRef={canvasRef} />}

              {/* Add RectSelection Layer */}
              {drawingMode === 'RectSelection' && (
                <RectSelectionDrawingComponent
                  pageNumber={pageNumber}
                  onDrawingCreated={handleDrawingCreated}
                  pdfCanvasRef={canvasRef}
                />
              )}

              {/* Add PinSelection Layer */}
              {drawingMode === 'PinSelection' && (
                <PinSelectionDrawingComponent
                  pageNumber={pageNumber}
                  onDrawingCreated={handleDrawingCreated}
                  pdfCanvasRef={canvasRef}
                />
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
