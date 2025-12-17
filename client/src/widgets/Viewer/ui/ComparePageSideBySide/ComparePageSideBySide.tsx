import React, { useEffect, useRef, useState, useContext, useCallback } from 'react';
import type { PDFPageProxy } from 'pdfjs-dist';
import { ViewerContext } from '../../model/context/viewerContext';
import classes from './ComparePageSideBySide.module.scss';
import { classNames } from '../../utils/classNames';
import { setSliderDragging, forceReleaseDrag } from '../../utils/dragControl/dragControl';

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

  const primaryCanvasRef = useRef<HTMLCanvasElement>(null!);
  const compareCanvasRef = useRef<HTMLCanvasElement>(null!);
  const containerRef = useRef<HTMLDivElement>(null);
  const sideBySideContainerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const [inView, setInView] = useState(false);
  const [hasRenderedPrimary, setHasRenderedPrimary] = useState(false);
  const [hasRenderedCompare, setHasRenderedCompare] = useState(false);
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  const rotation = pageRotations[pageNumber] || 0;

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        const isNowVisible = entry.isIntersecting && entry.intersectionRatio >= 0.1;

        if (isNowVisible !== inView) {
          setInView(isNowVisible);
        }
      },
      {
        rootMargin: '200px 0px',
        threshold: 0.1,
      },
    );
    const currentContainer = containerRef.current;
    if (currentContainer) {
      observer.observe(currentContainer);
    }
    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
    };
  }, [inView]);

  useEffect(() => {
    const isContentRendered = hasRenderedPrimary && (!comparePage || hasRenderedCompare);

    if (inView && isContentRendered && onBecameVisible) {
      onBecameVisible(pageNumber);

      if (inView && isContentRendered && sideBySideContainerRef.current) {
        const primaryViewport = page.getViewport({ scale, rotation, dontFlip: false });
        const compareViewport = comparePage?.getViewport({ scale, rotation, dontFlip: false });

        const primaryCSSWidth = Math.floor(primaryViewport.width);
        const primaryCSSHeight = Math.floor(primaryViewport.height);
        const compareCSSWidth = compareViewport ? Math.floor(compareViewport.width) : 0;
        const compareCSSHeight = compareViewport ? Math.floor(compareViewport.height) : 0;

        const maxWidth = Math.max(primaryCSSWidth, compareCSSWidth);
        const maxHeight = Math.max(primaryCSSHeight, compareCSSHeight);

        sideBySideContainerRef.current.style.width = `${maxWidth}px`;
        sideBySideContainerRef.current.style.height = `${maxHeight}px`;
      }
    }
  }, [inView, hasRenderedPrimary, hasRenderedCompare, comparePage, pageNumber, onBecameVisible, scale, rotation, page]);

  const shouldRender = inView || hasRenderedPrimary || hasRenderedCompare;

  const renderPageToCanvas = useCallback(
    async (
      pdfPage: PDFPageProxy | null,
      canvasRef: React.RefObject<HTMLCanvasElement>,
      setHasRendered: (value: boolean) => void,
    ) => {
      setHasRendered(false);

      if (!pdfPage || !canvasRef.current || !shouldRender) {
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
        return;
      }

      const canvas = canvasRef.current;
      const currentViewport = pdfPage.getViewport({ scale, rotation, dontFlip: false });
      const outputScale = window.devicePixelRatio || 1;

      const cssWidth = Math.floor(currentViewport.width);
      const cssHeight = Math.floor(currentViewport.height);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;
      canvas.width = Math.floor(cssWidth * outputScale);
      canvas.height = Math.floor(cssHeight * outputScale);

      const sideBySideWrapper = sideBySideContainerRef.current;
      if (sideBySideWrapper) {
        sideBySideWrapper.style.width = canvas.style.width;
        sideBySideWrapper.style.height = canvas.style.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(outputScale, outputScale);
      const renderContext = { canvasContext: ctx, viewport: currentViewport, canvas: canvasRef.current };

      let renderTask: ReturnType<typeof pdfPage.render> | null = null;
      try {
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
        setHasRendered(false);
      } finally {
        renderTask = null;
      }
    },
    [shouldRender, scale, rotation, pageNumber],
  );

  useEffect(() => {
    renderPageToCanvas(page, primaryCanvasRef, setHasRenderedPrimary);
  }, [page, renderPageToCanvas]);

  useEffect(() => {
    renderPageToCanvas(comparePage, compareCanvasRef, setHasRenderedCompare);
  }, [comparePage, renderPageToCanvas]);

  useEffect(() => {
    const touchMoveOptions = { passive: false, capture: true };

    const updateSliderPosition = (clientX: number) => {
      if (!sideBySideContainerRef.current) return;

      const rect = sideBySideContainerRef.current.getBoundingClientRect();
      const newX = clientX - rect.left;
      let newSliderPosition = (newX / rect.width) * 100;

      newSliderPosition = Math.max(0, Math.min(100, newSliderPosition));
      setSliderPosition(newSliderPosition);
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!isDraggingSlider) return;

      event.preventDefault();
      event.stopPropagation();
      updateSliderPosition(event.clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!isDraggingSlider) return;

      event.preventDefault();
      event.stopPropagation();

      const touch = event.touches[0];
      if (touch) {
        updateSliderPosition(touch.clientX);
      }
    };

    const handleMouseUp = (event: MouseEvent) => {
      event.stopPropagation();
      setIsDraggingSlider(false);
      if (sliderRef.current) sliderRef.current.style.cursor = 'col-resize';
      document.body.classList.remove('resizingHorizontal');
      setSliderDragging(false);
    };

    const handleTouchEnd = (event: TouchEvent) => {
      event.stopPropagation();
      setIsDraggingSlider(false);
      if (sliderRef.current) sliderRef.current.style.cursor = 'col-resize';
      document.body.classList.remove('resizingHorizontal');
      setSliderDragging(false);
    };

    if (isDraggingSlider) {
      setSliderDragging(true);
      if (sliderRef.current) sliderRef.current.style.cursor = 'col-resize';
      document.body.classList.add('resizingHorizontal');

      document.addEventListener('mousemove', handleMouseMove, true);
      document.addEventListener('mouseup', handleMouseUp, true);
      document.addEventListener('touchmove', handleTouchMove, touchMoveOptions);
      document.addEventListener('touchend', handleTouchEnd, true);
      document.addEventListener('touchcancel', handleTouchEnd, true);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove, true);
      document.removeEventListener('mouseup', handleMouseUp, true);
      document.removeEventListener('touchmove', handleTouchMove, touchMoveOptions);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('touchcancel', handleTouchEnd, true);

      if (sliderRef.current) sliderRef.current.style.cursor = 'col-resize';
      document.body.classList.remove('resizingHorizontal');
      setSliderDragging(false);
    };
  }, [isDraggingSlider]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDraggingSlider) {
        setIsDraggingSlider(false);
        forceReleaseDrag();
      }
    };

    const handleGlobalTouchEnd = () => {
      if (isDraggingSlider) {
        setIsDraggingSlider(false);
        forceReleaseDrag();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
    };
  }, [isDraggingSlider]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDraggingSlider) {
        setIsDraggingSlider(false);
        forceReleaseDrag();
      }
    };

    if (isDraggingSlider) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDraggingSlider]);

  const handleSliderMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSliderDragging(true);
    setIsDraggingSlider(true);
  };

  const handleSliderTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSliderDragging(true);
    setIsDraggingSlider(true);
  };

  return (
    <div ref={containerRef} className={classNames(classes.pageContainer, {}, [className])} id={id} data-page-number={pageNumber}>
      {shouldRender && (
        <div ref={sideBySideContainerRef} className={classes.sideBySideWrapper}>
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
          </div>

          <div className={classes.pageHalf} style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}>
            <div className={classes.canvasContainer}>
              {page && <canvas id={`primary-canvas-${pageNumber}`} ref={primaryCanvasRef} className={classes.pageCanvas} />}
            </div>
          </div>

          <div
            ref={sliderRef}
            className={classNames(classes.sliderHandle, {}, ['sliderHandle'])}
            style={{ left: `${sliderPosition}%` }}
            onMouseDown={handleSliderMouseDown}
            onTouchStart={handleSliderTouchStart}
            onMouseMove={(e) => isDraggingSlider && e.stopPropagation()}
            onMouseUp={(e) => isDraggingSlider && e.stopPropagation()}
            onTouchMove={(e) => isDraggingSlider && e.stopPropagation()}
            onTouchEnd={(e) => isDraggingSlider && e.stopPropagation()}
            data-dragscroll-ignore='true'>
            <div className={classNames(classes.sliderLine, {}, ['sliderLine'])}></div>
          </div>
        </div>
      )}
      {!shouldRender && <div style={{ height: '500px', border: '1px dashed lightgrey' }}>Loading...</div>}
    </div>
  );
};
