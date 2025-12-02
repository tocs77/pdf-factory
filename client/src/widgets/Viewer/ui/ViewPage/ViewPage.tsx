import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist';

import { classNames } from '../../utils/classNames';
import { ViewerContext } from '../../model/context/viewerContext';
import { Drawing } from '../../model/types/Drawings';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import CompleteDrawings from '../CompleteDrawings/CompleteDrawings';
import { DraftLayer } from '../DraftLayer/DraftLayer';
import { DrawAreaLayer } from '../DrawAreaLayer/DrawAreaLayer';
import { RulerDrawingLayer } from '../RulerDrawingLayer/RulerDrawingLayer';
import { TextLayer } from '../TextLayer/TextLayer';
import RectSelectionDrawingComponent from '../RectSelectionDrawingComponent/RectSelectionDrawingComponent';
import PinSelectionDrawingComponent from '../PinSelectionDrawingComponent/PinSelectionDrawingComponent';
import { ZoomAreaLayer } from '../ZoomAreaLayer/ZoomAreaLayer';

import classes from './ViewPage.module.scss';

// Page component for rendering a single PDF page
interface ViewPageProps {
  onBecameVisible?: (pageNumber: number) => void;
  page: PDFPageProxy;
  pageNumber: number;
  id: string;
  className?: string;
  drawings: Drawing[];
  onDrawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
  onDrawingClicked?: (id: string) => void;
  selectedPage: number; // current selected page from parent
  mobile: boolean;
}

// Threshold for determining when to re-render at the current scale
// If scale difference is greater than this, re-render at the current scale
const SCALE_THRESHOLD = 0.5;

export const ViewPage = ({
  page,
  pageNumber,
  id,
  className,
  drawings,
  onDrawingCreated,
  onBecameVisible,
  onDrawingClicked,
  selectedPage,
  mobile,
}: ViewPageProps) => {
  const { state } = useContext(ViewerContext);
  const { drawingMode, pageRotations, scale, currentDrawingPage, isPinchZooming, isWheelZooming } = state;

  const canvasRef = useRef<HTMLCanvasElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [isCentered, setIsCentered] = useState(false);
  const [hasRendered, setHasRendered] = useState(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState<any>(null);
  const [baseViewport, setBaseViewport] = useState<any>(null);
  const currentRenderTaskRef = useRef<RenderTask | null>(null);
  const isRenderingRef = useRef<boolean>(false);

  // Track the scale at which the PDF was last rendered
  const [baseScale, setBaseScale] = useState<number>(scale);

  // Refs to track previous rotation to avoid unnecessary re-renders
  const prevRotationRef = useRef<number>(pageRotations[pageNumber] || 0);
  const highQualityCanvasRef = useRef<HTMLCanvasElement | null>(null);

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
  const handleDrawingClick = (event: React.MouseEvent<HTMLDivElement>) => {
    // Only proceed if drawing mode is 'none' and canvas ref is available
    if (drawingMode !== 'none' || !canvasRef.current || !onDrawingClicked || isDraggingRef.current) return;

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
    const normalizedPoint = normalizeCoordinatesToZeroRotation(
      { x, y },
      canvas.offsetWidth,
      canvas.offsetHeight,
      scale,
      rotation,
    );

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

  // Helper function to check if this page contains the center of the viewport
  const checkIfPageContainsViewportCenter = () => {
    if (!containerRef.current) return false;

    // Get viewport dimensions and calculate midpoint
    const viewportHeight = window.innerHeight;
    const viewportCenter = window.scrollY + viewportHeight / 2;

    // Get page position
    const rect = containerRef.current.getBoundingClientRect();
    const pageTop = window.scrollY + rect.top;
    const pageBottom = pageTop + rect.height;

    // Check if viewport center is within this page
    return viewportCenter >= pageTop && viewportCenter <= pageBottom;
  };

  // Render the PDF page at the current scale
  const renderPageAtCurrentScale = async () => {
    if (!page || !canvasRef.current) return;

    try {
      // If there's an ongoing render task, cancel it first
      if (currentRenderTaskRef.current) {
        try {
          await currentRenderTaskRef.current.cancel();
        } catch (_error) {
          // Ignore cancellation errors
        }
        currentRenderTaskRef.current = null;
      }

      // Set rendering flag to prevent concurrent renders
      if (isRenderingRef.current) {
        return;
      }

      isRenderingRef.current = true;

      // Create viewport with rotation at the current scale
      const currentViewport = page.getViewport({
        scale,
        rotation: rotation || 0,
        dontFlip: false,
      });

      // Update viewport state
      setViewport(currentViewport);
      setBaseViewport(currentViewport);

      // Set canvas dimensions to match viewport
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;

      // Set display size of canvas (CSS pixels)
      const isRotated90or270 = rotation === 90 || rotation === 270;

      if (isRotated90or270) {
        if (canvasWrapperRef.current) {
          canvasWrapperRef.current.style.width = `${Math.floor(currentViewport.width)}px`;
          canvasWrapperRef.current.style.height = `${Math.floor(currentViewport.height)}px`;
        }
        canvas.style.width = `${Math.floor(currentViewport.width)}px`;
        canvas.style.height = `${Math.floor(currentViewport.height)}px`;
      } else {
        canvas.style.width = `${Math.floor(currentViewport.width)}px`;
        canvas.style.height = `${Math.floor(currentViewport.height)}px`;
        if (canvasWrapperRef.current) {
          canvasWrapperRef.current.style.width = canvas.style.width;
          canvasWrapperRef.current.style.height = canvas.style.height;
        }
      }

      // Apply device pixel ratio for high-resolution rendering
      const pixelRatio = window.devicePixelRatio || 1;

      // Set actual size in memory
      canvas.width = Math.floor(currentViewport.width * pixelRatio);
      canvas.height = Math.floor(currentViewport.height * pixelRatio);

      // Clear the canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Scale for high DPI displays
      ctx.scale(pixelRatio, pixelRatio);

      // Set up render context
      const renderContext = {
        canvasContext: ctx,
        viewport: currentViewport,
        canvas: canvas,
      };

      // Render PDF page to the canvas
      const renderTask = page.render(renderContext);
      currentRenderTaskRef.current = renderTask;

      await renderTask.promise;
      currentRenderTaskRef.current = null;

      // Create a copy of the rendered canvas for future scaling operations
      const backupCanvas = document.createElement('canvas');
      backupCanvas.width = canvas.width;
      backupCanvas.height = canvas.height;
      const backupCtx = backupCanvas.getContext('2d', { willReadFrequently: true });
      if (backupCtx) {
        backupCtx.drawImage(canvas, 0, 0);
        highQualityCanvasRef.current = backupCanvas;
      }

      // Update the base scale
      setBaseScale(scale);
      setHasRendered(true);
    } catch (error: any) {
      if (!error?.message?.includes('cancelled')) {
        console.error(`[ERROR][Page ${pageNumber}] Error rendering page:`, error);
      }
    } finally {
      isRenderingRef.current = false;
    }
  };

  // Apply scale to the display canvas
  const updateDisplayCanvas = () => {
    if (!canvasRef.current || !highQualityCanvasRef.current || !baseViewport) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Calculate the current viewport based on user scale
    const currentViewport = page.getViewport({
      scale,
      rotation: rotation || 0,
      dontFlip: false,
    });

    // Update viewport state
    setViewport(currentViewport);

    // Set display size of canvas (CSS pixels)
    const isRotated90or270 = rotation === 90 || rotation === 270;

    if (isRotated90or270) {
      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.style.width = `${Math.floor(currentViewport.width)}px`;
        canvasWrapperRef.current.style.height = `${Math.floor(currentViewport.height)}px`;
      }
      canvas.style.width = `${Math.floor(currentViewport.width)}px`;
      canvas.style.height = `${Math.floor(currentViewport.height)}px`;
    } else {
      canvas.style.width = `${Math.floor(currentViewport.width)}px`;
      canvas.style.height = `${Math.floor(currentViewport.height)}px`;
      if (canvasWrapperRef.current) {
        canvasWrapperRef.current.style.width = canvas.style.width;
        canvasWrapperRef.current.style.height = canvas.style.height;
      }
    }

    // Apply device pixel ratio for high-resolution rendering
    const pixelRatio = window.devicePixelRatio || 1;

    // Set actual size in memory
    canvas.width = Math.floor(currentViewport.width * pixelRatio);
    canvas.height = Math.floor(currentViewport.height * pixelRatio);

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply the scaling
    ctx.scale(pixelRatio, pixelRatio);

    // Calculate dimensions for drawing
    const sourceWidth = baseViewport.width * pixelRatio;
    const sourceHeight = baseViewport.height * pixelRatio;
    const targetWidth = currentViewport.width;
    const targetHeight = currentViewport.height;

    // Draw the high quality canvas onto the display canvas with proper scaling
    ctx.drawImage(highQualityCanvasRef.current, 0, 0, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
  };

  // Initial rendering and scale change handling
  useEffect(() => {
    const handleRenderOrUpdate = async () => {
      // Determine if this page should render:
      // 1. It's visible, OR
      // 2. It's the selected page, OR
      // 3. It's adjacent to the selected page (with a 1-page buffer)
      const isAdjacent = Math.abs(pageNumber - selectedPage) <= 1;
      const shouldRenderNow = inView || pageNumber === selectedPage || isAdjacent;

      if (!shouldRenderNow) return;

      // Calculate scale difference for determining if full render is needed
      const scaleDifference = Math.abs(scale - baseScale);
      const rotationChanged = rotation !== prevRotationRef.current;

      // For initial render or when scale difference exceeds threshold
      if (
        // Only do a full render if:
        // 1. Never rendered before, OR
        // 2. No high quality canvas available, OR
        // 3. Scale difference exceeds threshold AND not currently pinch/wheel zooming, OR
        // 4. Rotation changed
        !highQualityCanvasRef.current ||
        (scaleDifference > SCALE_THRESHOLD && !isPinchZooming && !isWheelZooming) ||
        rotationChanged
      ) {
        // Update the rotation ref
        prevRotationRef.current = rotation;
        // Render PDF at current scale directly
        await renderPageAtCurrentScale();
      } else {
        // Just update display canvas with scaling
        updateDisplayCanvas();
      }
    };

    handleRenderOrUpdate();
  }, [page, rotation, scale, pageNumber, selectedPage, inView, baseScale, isPinchZooming, isWheelZooming]);

  // Re-render when rotation changes
  useEffect(() => {
    const rotation = pageRotations[pageNumber] || 0;
    const prevRotation = prevRotationRef.current;

    if (rotation !== prevRotation) {
      // For rotation changes we need to reset the high quality canvas
      // because content needs to be re-rendered at the new rotation angle
      highQualityCanvasRef.current = null;
      prevRotationRef.current = rotation;

      // Force a re-render immediately
      renderPageAtCurrentScale();

      // Set a timer to re-center this page after rotation is applied
      // This ensures the page stays as the current page even after layout changes
      setTimeout(() => {
        if (pageNumber === selectedPage) {
          const pageElement = document.getElementById(`pdf-page-${pageNumber}`);
          if (pageElement) {
            pageElement.scrollIntoView({ behavior: 'auto', block: 'center' });
          }
        }
      }, 300);
    }
  }, [pageNumber, pageRotations, selectedPage]);

  // Remove console log from visibility changes
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        // Check if page is intersecting with the viewport
        const isNowVisible = entry.isIntersecting && entry.intersectionRatio >= 0.1;

        // Only update state if visibility actually changed to prevent unnecessary re-renders
        if (isNowVisible !== inView) {
          setInView(isNowVisible);
        }

        // Check if this page contains the center point of the viewport
        if (isNowVisible) {
          const nowCentered = checkIfPageContainsViewportCenter();
          setIsCentered(nowCentered);
        } else {
          setIsCentered(false);
        }
      },
      {
        rootMargin: '300px 0px', // Increase pre-rendering margin for high scales
        threshold: [0.01, 0.1, 0.2, 0.3, 0.4, 0.5], // Add lower threshold for better detection
      },
    );

    const currentContainer = containerRef.current; // Capture ref value
    if (currentContainer) {
      observer.observe(currentContainer);
    }

    // Also set up scroll handler to check centering continuously
    const handleScroll = () => {
      if (inView) {
        const nowCentered = checkIfPageContainsViewportCenter();
        setIsCentered(nowCentered);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, [inView, pageNumber, scale, checkIfPageContainsViewportCenter]);

  // In the part where hasRendered is updated
  useEffect(() => {
    // Reset rendering state only when page or rotation changes, not on scale changes
    if (!page) return undefined;

    // Only reset hasRendered if:
    // 1. Page changes, or
    // 2. Rotation changes
    // Do NOT reset it for scale changes
    const shouldResetRender = !hasRendered;

    if (shouldResetRender) {
      // Mark as rendered after a short delay to ensure canvas has fully drawn
      const renderTimeout = setTimeout(() => {
        setHasRendered(true);
      }, 500);

      return () => {
        clearTimeout(renderTimeout);
      };
    }

    return undefined;
  }, [page, pageNumber, rotation, hasRendered]);

  // Track when page becomes both visible and rendered
  useEffect(() => {
    // Only notify if page is centered AND has rendered its content
    if (isCentered && hasRendered && onBecameVisible) {
      onBecameVisible(pageNumber);
    }
  }, [isCentered, hasRendered, pageNumber, onBecameVisible]);

  // Track when the page is centered in the viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Consider page "centered" when it's more than 50% visible
          const newIsCentered = entry.isIntersecting && entry.intersectionRatio >= 0.5;

          if (newIsCentered !== isCentered) {
            setIsCentered(newIsCentered);
          }
        });
      },
      {
        threshold: [0, 0.1, 0.5, 0.9], // Check multiple thresholds for better precision
      },
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [pageNumber, isCentered]);

  const handleDrawingCreated = (drawing: Omit<Drawing, 'id'>) => {
    // Call the parent's onDrawingCreated with the enhanced drawing
    if (onDrawingCreated) {
      // Use type assertion to handle the Drawing union type
      onDrawingCreated(drawing);
    }
  };

  // Cleanup render task on unmount or when page changes
  useEffect(() => {
    return () => {
      // Cancel any pending render tasks when the component unmounts or page changes
      if (currentRenderTaskRef.current) {
        currentRenderTaskRef.current.cancel();
        currentRenderTaskRef.current = null;
      }
    };
  }, [pageNumber, page]);

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
          onClick={handleDrawingClick}>
          <canvas ref={canvasRef} className={classes.pageCanvas} />

          {/* Text Layer - only render when text tool is selected */}
          {(drawingMode === 'textUnderline' || drawingMode === 'textCrossedOut' || drawingMode === 'textHighlight') &&
            viewport && (
              <TextLayer
                page={page}
                viewport={viewport}
                scale={scale}
                rotation={rotation}
                pageNumber={pageNumber}
                onDrawingCreated={handleDrawingCreated}
                pdfCanvasRef={canvasRef}
                mobile={mobile}
              />
            )}

          {/* Drawing components - only render when respective tool is selected */}
          {(currentDrawingPage === 0 || currentDrawingPage === -1 || currentDrawingPage === pageNumber) && (
            <DraftLayer pageNumber={pageNumber} onDrawingCreated={handleDrawingCreated} pdfCanvasRef={canvasRef} />
          )}
          {drawingMode === 'drawArea' &&
            (currentDrawingPage === 0 || currentDrawingPage === -1 || currentDrawingPage === pageNumber) && (
              <DrawAreaLayer pageNumber={pageNumber} onDrawingCreated={handleDrawingCreated} pdfCanvasRef={canvasRef} />
            )}
          {/* Add rectSelection Layer */}
          {drawingMode === 'rectSelection' && (
            <RectSelectionDrawingComponent
              pageNumber={pageNumber}
              onDrawingCreated={handleDrawingCreated}
              pdfCanvasRef={canvasRef}
            />
          )}

          {/* Add pinSelection Layer */}
          {drawingMode === 'pinSelection' &&
            (currentDrawingPage === 0 || currentDrawingPage === -1 || currentDrawingPage === pageNumber) && (
              <PinSelectionDrawingComponent
                pageNumber={pageNumber}
                onDrawingCreated={handleDrawingCreated}
                pdfCanvasRef={canvasRef}
              />
            )}

          {/* Add ruler Layer */}
          {drawingMode === 'ruler' &&
            (currentDrawingPage === 0 || currentDrawingPage === -1 || currentDrawingPage === pageNumber) && (
              <RulerDrawingLayer pageNumber={pageNumber} pdfCanvasRef={canvasRef} enableSnapPoints={false} />
            )}

          {/* Add zoomArea Layer */}
          {drawingMode === 'zoomArea' &&
            (currentDrawingPage === 0 || currentDrawingPage === -1 || currentDrawingPage === pageNumber) && (
              <ZoomAreaLayer pageNumber={pageNumber} pdfCanvasRef={canvasRef} />
            )}

          <CompleteDrawings pageNumber={pageNumber} drawings={drawings} />
        </div>
      </div>
    </div>
  );
};
