import React, { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { ViewerContext } from '../../model/context/viewerContext';
import classes from './ComparePageSideBySide.module.scss';
import { classNames } from '@/shared/utils';
import { setSliderDragging, forceReleaseDrag } from '@/shared/utils';

interface ComparePageSideBySideProps {
  page: PDFPageProxy;
  comparePage: PDFPageProxy | null;
  pageNumber: number;
  id: string;
  className?: string;
  onBecameVisible?: (pageNumber: number) => void;
}

export const ComparePageSideBySide: React.FC<ComparePageSideBySideProps> = ({
  page,
  comparePage,
  pageNumber,
  id,
  className,
  onBecameVisible,
}) => {
  const { state } = useContext(ViewerContext);
  const { pageRotations, scale } = state;

  // Refs for canvases (primary and comparison)
  const primaryCanvasRef = useRef<HTMLCanvasElement>(null);
  const compareCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Main container for observer
  const sideBySideContainerRef = useRef<HTMLDivElement>(null); // Container for the two canvases and slider
  const sliderRef = useRef<HTMLDivElement>(null);

  // State variables
  const [inView, setInView] = useState(false);
  const [hasRenderedPrimary, setHasRenderedPrimary] = useState(false);
  const [hasRenderedCompare, setHasRenderedCompare] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50); // Percentage from left
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const rotation = pageRotations[pageNumber] || 0;

  // Use Intersection Observer to detect when the page is visible
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver((entries) => setInView(entries[0].isIntersecting), {
      rootMargin: '200px 0px', // Render slightly before entering viewport
      threshold: 0.01,
    });
    const currentContainer = containerRef.current;
    if (currentContainer) {
      observer.observe(currentContainer);
    }
    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
    };
  }, []);

  // Effect to notify parent when visibility changes (after rendering)
  useEffect(() => {
    const isContentRendered = hasRenderedPrimary && (!comparePage || hasRenderedCompare);
    if (inView && isContentRendered && onBecameVisible) {
      // console.log(`[SideBySide ${pageNumber}] Became visible AND rendered, notifying parent.`); // Keep commented for now
      onBecameVisible(pageNumber);

      // Also set the wrapper size when content is rendered and in view
      // This ensures the wrapper has the correct dimensions based on the final content
      if (inView && isContentRendered && sideBySideContainerRef.current) {
        const primaryViewport = page.getViewport({ scale, rotation, dontFlip: false });
        const compareViewport = comparePage?.getViewport({ scale, rotation, dontFlip: false });

        const primaryCSSWidth = Math.floor(primaryViewport.width);
        const primaryCSSHeight = Math.floor(primaryViewport.height);
        const compareCSSWidth = compareViewport ? Math.floor(compareViewport.width) : 0;
        const compareCSSHeight = compareViewport ? Math.floor(compareViewport.height) : 0;

        // Use the maximum dimensions of either page
        const maxWidth = Math.max(primaryCSSWidth, compareCSSWidth);
        const maxHeight = Math.max(primaryCSSHeight, compareCSSHeight);

        sideBySideContainerRef.current.style.width = `${maxWidth}px`;
        sideBySideContainerRef.current.style.height = `${maxHeight}px`;
      }
    }
  }, [inView, hasRenderedPrimary, hasRenderedCompare, comparePage, pageNumber, onBecameVisible]);

  const shouldRender = inView || hasRenderedPrimary || hasRenderedCompare;

  // Generic function to setup and render a page to a canvas
  const renderPageToCanvas = async (
    pdfPage: PDFPageProxy | null,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    setHasRendered: (value: boolean) => void,
  ) => {
    // Reset render state when starting
    setHasRendered(false);

    // const pageRefStr = pdfPage?.ref ? `${pdfPage.ref.gen}-${pdfPage.ref.num}` : 'no ref'; // Keep for potential future debugging
    // const pageId = pdfPage ? `page ${pdfPage.pageNumber} (Ref: ${pageRefStr})` : 'null'; // Keep for potential future debugging
    // console.log(`[RenderSideBySide] Attempting to render ${pageId} to canvas:`, canvasRef.current?.id || 'no id');

    if (!pdfPage || !canvasRef.current || !shouldRender) {
      // If we shouldn't render but there's a canvas, clear it
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    const currentViewport = pdfPage.getViewport({ scale, rotation, dontFlip: false });
    const outputScale = window.devicePixelRatio || 1;

    // --- Canvas Size Setup ---
    const cssWidth = Math.floor(currentViewport.width);
    const cssHeight = Math.floor(currentViewport.height);
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.width = Math.floor(cssWidth * outputScale);
    canvas.height = Math.floor(cssHeight * outputScale);

    // --- Wrapper Size Setup ---
    // Ensure the main wrapper adapts to the largest necessary dimension (consider rotation)
    const sideBySideWrapper = sideBySideContainerRef.current;
    if (sideBySideWrapper) {
      // Set wrapper size based on our test dimensions
      sideBySideWrapper.style.width = canvas.style.width;
      sideBySideWrapper.style.height = canvas.style.height;
    }

    // --- Rendering ---
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(outputScale, outputScale);
    const renderContext = { canvasContext: ctx, viewport: currentViewport };

    let renderTask: ReturnType<typeof pdfPage.render> | null = null;
    try {
      // Clear previous rendering (using scaled dimensions)
      ctx.clearRect(0, 0, canvas.width / outputScale, canvas.height / outputScale);
      renderTask = pdfPage.render(renderContext);
      await renderTask.promise;
      setHasRendered(true);
    } catch (error: any) {
      if (error.name !== 'RenderingCancelledException') {
        console.error(`Error rendering PDF page ${pageNumber} for side-by-side:`, error);
      } else {
        console.debug(`Rendering cancelled for page ${pageNumber} (side-by-side)`);
      }
      // Ensure render state is false if rendering failed/cancelled
      setHasRendered(false);
    } finally {
      renderTask = null; // Clear task ref
    }
  };

  // Effect to render primary page
  useEffect(() => {
    renderPageToCanvas(page, primaryCanvasRef, setHasRenderedPrimary);
    // Add cleanup for potential render tasks if needed, although renderPageToCanvas tries to handle it
    return () => {
      // Potential cleanup if renderPageToCanvas doesn't fully cover cancellation on unmount/change
    };
  }, [page, scale, rotation, shouldRender]); // shouldRender dependency ensures re-render when coming into view

  // Effect to render comparison page
  useEffect(() => {
    renderPageToCanvas(comparePage, compareCanvasRef, setHasRenderedCompare);
    // Add cleanup for potential render tasks if needed
    return () => {
      // Potential cleanup
    };
  }, [comparePage, scale, rotation, shouldRender]); // shouldRender dependency

  // --- Slider Drag Logic ---
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingSlider || !sideBySideContainerRef.current) return;

      // Prevent any default browser behavior
      event.preventDefault();
      event.stopPropagation();

      const rect = sideBySideContainerRef.current.getBoundingClientRect();
      let newX = event.clientX - rect.left;
      let newSliderPosition = (newX / rect.width) * 100;

      // Clamp position between 0 and 100
      newSliderPosition = Math.max(0, Math.min(100, newSliderPosition));
      setSliderPosition(newSliderPosition);
    };

    const handleMouseUp = (event: MouseEvent) => {
      // Always handle the mouse up event, regardless of drag state
      // This ensures we clean up even if the event is missed

      // Prevent bubbling
      event.stopPropagation();

      setIsDraggingSlider(false);
      // Restore cursors
      if (sliderRef.current) sliderRef.current.style.cursor = 'col-resize';
      document.body.classList.remove('resizingHorizontal');

      // Update global dragging state
      setSliderDragging(false);
    };

    if (isDraggingSlider) {
      // Update global dragging state
      setSliderDragging(true);

      // Set cursors for visual feedback
      if (sliderRef.current) sliderRef.current.style.cursor = 'col-resize';
      document.body.classList.add('resizingHorizontal');

      // Use capture phase to ensure we get the events
      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('mouseup', handleMouseUp, true);
    }

    return () => {
      // Clean up listeners and styles on unmount or if isDraggingSlider becomes false
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);

      if (sliderRef.current) sliderRef.current.style.cursor = 'col-resize';
      document.body.classList.remove('resizingHorizontal');

      // Reset global dragging state
      setSliderDragging(false);
    };
  }, [isDraggingSlider]);

  // Always listen for mouse up globally to ensure drag is ended
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingSlider) {
        setIsDraggingSlider(false);
        forceReleaseDrag(); // Use our utility function instead
      }
    };

    // Add global listener to catch mouse up events that might be missed
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDraggingSlider]);

  // Handle keyboard events to cancel dragging with ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingSlider) {
        setIsDraggingSlider(false);
        forceReleaseDrag(); // Use our utility function instead
      }
    };

    if (isDraggingSlider) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDraggingSlider]);

  // Log props on every render for debugging
  // const primaryPageRefStr = page?.ref ? `${page.ref.gen}-${page.ref.num}` : 'no ref';
  // const comparePageRefStr = comparePage?.ref ? `${comparePage.ref.gen}-${comparePage.ref.num}` : 'no ref';
  // console.log(
  //   `[SideBySide Render] Page ${pageNumber} - Primary Prop Ref: ${primaryPageRefStr}, Compare Prop Ref: ${comparePageRefStr}`,
  // );

  const handleSliderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Prevent default behavior and stop propagation
    event.preventDefault();
    event.stopPropagation();

    // Set global dragging state
    setSliderDragging(true);

    setIsDraggingSlider(true);
  };

  // Helper to determine if a click is near the slider
  const isNearSlider = (clientX: number) => {
    if (!sideBySideContainerRef.current) return false;

    const rect = sideBySideContainerRef.current.getBoundingClientRect();
    const sliderX = rect.left + (rect.width * sliderPosition) / 100;

    // Define "near" as within 15 pixels of the slider
    return Math.abs(clientX - sliderX) < 15;
  };

  const handleWrapperMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    // Check if the click is near the slider
    if (isNearSlider(event.clientX)) {
      // If near slider, stop propagation to prevent PDF drag-to-scroll
      event.stopPropagation();
    }
  };

  return (
    <div ref={containerRef} className={classNames(classes.pageContainer, {}, [className])} id={id} data-page-number={pageNumber}>
      {/* Only render content if it should be rendered (in view or previously rendered) */}
      {shouldRender && (
        <div ref={sideBySideContainerRef} className={classes.sideBySideWrapper} onMouseDown={handleWrapperMouseDown}>
          {/* Container for the Compare Page (Renders underneath) */}
          <div
            className={classNames(classes.pageHalf, {}, [classes.comparePage])}
            style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}>
            <div className={classes.canvasContainer}>
              {comparePage ? (
                <canvas id={`compare-canvas-${pageNumber}`} ref={compareCanvasRef} className={classes.pageCanvas} />
              ) : (
                <div className={classes.noComparePage}>No comparison page selected</div>
              )}
            </div>
            {/* TODO: Add text/drawing layers if needed, placed absolutely */}
          </div>

          {/* Container for the Primary Page (Renders on top) */}
          {/* Added explicit z-index */}
          <div className={classes.pageHalf} style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
            <div className={classes.canvasContainer}>
              {/* Ensure primary page always tries to render if shouldRender is true */}
              {page && <canvas id={`primary-canvas-${pageNumber}`} ref={primaryCanvasRef} className={classes.pageCanvas} />}
            </div>
            {/* TODO: Add text/drawing layers if needed, placed absolutely */}
          </div>

          {/* Slider Handle */}
          <div
            ref={sliderRef}
            className={classNames(classes.sliderHandle, {}, ['sliderHandle'])}
            style={{ left: `${sliderPosition}%` }}
            onMouseDown={handleSliderMouseDown}
            onMouseMove={(e) => isDraggingSlider && e.stopPropagation()}
            onMouseUp={(e) => isDraggingSlider && e.stopPropagation()}>
            <div className={classNames(classes.sliderLine, {}, ['sliderLine'])}></div>
            {/* Optional: Add icons/arrows to the handle */}
          </div>
        </div>
      )}
      {/* Render placeholder if not shouldRender? Or rely on parent */}
      {!shouldRender && <div style={{ height: '500px', border: '1px dashed lightgrey' }}>Loading...</div>}
    </div>
  );
};
