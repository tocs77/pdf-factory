import { useEffect, useRef, useState, useContext } from 'react';
import type { PDFPageProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';
import { ViewerContext } from '../../model/context/viewerContext';
import classes from './ComparePage.module.scss';
import { classNames } from '@/shared/utils';

interface ComparePageProps {
  page: PDFPageProxy;
  comparePage: PDFPageProxy | null; // Second page for comparison, might be null
  pageNumber: number;
  id: string;
  className?: string;
  mainColor: string; // Color for unique content on the main page
  comparisonColor: string; // Color for unique content on the comparison page
  onBecameVisible?: (pageNumber: number) => void;
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

// Color for pixels that match on both pages
const MIX_COLOR = { r: 0, g: 0, b: 0 }; // Black

export const ComparePage = ({
  page,
  comparePage,
  pageNumber,
  id,
  className,
  mainColor,
  comparisonColor,
  onBecameVisible,
}: ComparePageProps) => {
  const { state } = useContext(ViewerContext);
  const { pageRotations, scale } = state;

  // Refs for the canvases
  const primaryCanvasRef = useRef<HTMLCanvasElement>(null); // Hidden canvas for main page rendering
  const compareCanvasRef = useRef<HTMLCanvasElement>(null); // Hidden canvas for comparison page rendering
  const resultCanvasRef = useRef<HTMLCanvasElement>(null); // Visible canvas showing the comparison result

  // Refs for DOM elements
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // State variables
  const [inView, setInView] = useState(false);
  const [hasRenderedPrimary, setHasRenderedPrimary] = useState(false);
  const [hasRenderedCompare, setHasRenderedCompare] = useState(false);

  const rotation = pageRotations[pageNumber] || 0;

  // Use Intersection Observer to detect when the page is visible
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver((entries) => setInView(entries[0].isIntersecting), {
      rootMargin: '200px 0px', // Render slightly before entering viewport
      threshold: 0.01,
    });
    const currentContainer = containerRef.current; // Capture ref value
    if (currentContainer) {
      observer.observe(currentContainer);
    }
    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
    };
  }, []);

  // Effect to notify parent when visibility changes
  useEffect(() => {
    // Determine if the necessary content has rendered
    const isContentRendered = hasRenderedPrimary && (!comparePage || hasRenderedCompare);

    // Only notify if in view AND the necessary content has rendered
    if (inView && isContentRendered && onBecameVisible) {
      onBecameVisible(pageNumber);
    }
  }, [inView, hasRenderedPrimary, hasRenderedCompare, comparePage, pageNumber, onBecameVisible]);

  const shouldRenderPrimary = inView || hasRenderedPrimary;
  const shouldRenderCompare = (inView || hasRenderedCompare) && !!comparePage;

  // Setup canvas dimensions and context
  const setupCanvas = (canvas: HTMLCanvasElement | null, currentViewport: any) => {
    if (!canvas) return null;

    const parent = canvas.parentElement;
    if (!parent) return null;

    const outputScale = window.devicePixelRatio || 1;
    const totalScale = outputScale; // Using device pixel ratio for sharpness
    const isRotated90or270 = rotation === 90 || rotation === 270;

    // Set canvas style dimensions based on viewport
    if (isRotated90or270) {
      parent.style.width = `${Math.floor(currentViewport.width)}px`;
      parent.style.height = `${Math.floor(currentViewport.height)}px`;
      canvas.style.width = `${Math.floor(currentViewport.width)}px`;
      canvas.style.height = `${Math.floor(currentViewport.height)}px`;
    } else {
      canvas.style.width = `${Math.floor(currentViewport.width)}px`;
      canvas.style.height = `${Math.floor(currentViewport.height)}px`;
    }

    // Set canvas actual dimensions considering device pixel ratio
    canvas.width = Math.floor(currentViewport.width * totalScale);
    canvas.height = Math.floor(currentViewport.height * totalScale);

    // Ensure the wrapper matches the canvas size
    if (canvasWrapperRef.current) {
      canvasWrapperRef.current.style.width = canvas.style.width;
      canvasWrapperRef.current.style.height = canvas.style.height;
    }

    return {
      canvas,
      ctx: canvas.getContext('2d', { willReadFrequently: true }), // Enable optimizations for getImageData
      scale: totalScale,
    };
  };

  // Function to compare the two rendered canvases pixel by pixel
  const compareAndGenerateResult = () => {
    // Ensure required elements and states are ready
    if (!hasRenderedPrimary || !primaryCanvasRef.current || !resultCanvasRef.current) return;
    // If comparing, wait until the comparison page has also rendered
    if (comparePage && !hasRenderedCompare) return;

    // Get viewports to determine dimensions
    const primaryViewport = page.getViewport({ scale, rotation, dontFlip: false });
    const compareViewport = comparePage?.getViewport({ scale, rotation, dontFlip: false });

    // Determine max dimensions needed for the result canvas (in CSS pixels, before scaling)
    const primaryCSSWidth = primaryViewport.width;
    const primaryCSSHeight = primaryViewport.height;
    const compareCSSWidth = compareViewport?.width ?? 0;
    const compareCSSHeight = compareViewport?.height ?? 0;
    const maxCSSWidth = Math.max(primaryCSSWidth, compareCSSWidth);
    const maxCSSHeight = Math.max(primaryCSSHeight, compareCSSHeight);

    // Create a synthetic viewport object reflecting the maximum dimensions for setupCanvas
    // We use the primary viewport's transform/rotation/scale as a base
    const resultViewport = {
      ...primaryViewport, // Copy properties like scale, rotation, transform
      width: maxCSSWidth,
      height: maxCSSHeight,
      // Adjust viewBox if necessary, though setupCanvas mainly uses width/height
      viewBox: [0, 0, maxCSSWidth / scale, maxCSSHeight / scale],
    };

    // Setup the result canvas using the maximum dimensions
    const resultCanvasSetup = setupCanvas(resultCanvasRef.current, resultViewport);
    if (!resultCanvasSetup || !resultCanvasSetup.ctx) return;
    const { ctx: resultCtx, canvas: resultCanvas } = resultCanvasSetup; // Need the actual canvas dimensions

    // Get context and image data from the primary canvas
    const primaryCtx = primaryCanvasRef.current.getContext('2d', { willReadFrequently: true });
    if (!primaryCtx) return;
    // It's possible the primary canvas hasn't been set up yet if rendering is fast, add a check
    if (primaryCanvasRef.current.width === 0 || primaryCanvasRef.current.height === 0) return;
    const primaryImageData = primaryCtx.getImageData(0, 0, primaryCanvasRef.current.width, primaryCanvasRef.current.height);
    const primaryData = primaryImageData.data;
    const primaryCanvasWidth = primaryCanvasRef.current.width;
    const primaryCanvasHeight = primaryCanvasRef.current.height;

    // Create new image data for the result, sized to the result canvas
    const resultImageData = resultCtx.createImageData(resultCanvas.width, resultCanvas.height);
    const resultData = resultImageData.data;

    // Get context and image data from the comparison canvas (if it exists and is rendered)
    let compareData: Uint8ClampedArray | null = null;
    let compareCanvasWidth = 0;
    let compareCanvasHeight = 0;
    if (comparePage && hasRenderedCompare && compareCanvasRef.current) {
      // Add dimension check for compare canvas as well
      if (compareCanvasRef.current.width > 0 && compareCanvasRef.current.height > 0) {
        const compareCtx = compareCanvasRef.current.getContext('2d', { willReadFrequently: true });
        if (compareCtx) {
          compareCanvasWidth = compareCanvasRef.current.width;
          compareCanvasHeight = compareCanvasRef.current.height;
          const compareImageData = compareCtx.getImageData(0, 0, compareCanvasWidth, compareCanvasHeight);
          compareData = compareImageData.data;
        }
      } else {
        // Compare canvas exists but hasn't been sized/rendered yet, wait.
        return;
      }
    }

    // Parse the colors
    const mainRgb = hexToRgb(mainColor);
    const compareRgb = hexToRgb(comparisonColor);
    if (!mainRgb || !compareRgb) {
      console.error('Invalid main or comparison color provided.');
      return; // Exit if colors are invalid
    }

    const whiteThreshold = 240; // Pixels >= this value are considered white/near-white

    // Iterate through each pixel of the result canvas
    for (let y = 0; y < resultCanvas.height; y++) {
      for (let x = 0; x < resultCanvas.width; x++) {
        const resultIndex = (y * resultCanvas.width + x) * 4;

        // --- Primary Pixel Check ---
        let pR = 255,
          pG = 255,
          pB = 255,
          pA = 0; // Default: transparent white
        let primaryIsWhite = true;
        // Check if current (x, y) is within the bounds of the primary canvas
        if (primaryData && x < primaryCanvasWidth && y < primaryCanvasHeight) {
          const primaryIndex = (y * primaryCanvasWidth + x) * 4;
          pR = primaryData[primaryIndex];
          pG = primaryData[primaryIndex + 1];
          pB = primaryData[primaryIndex + 2];
          pA = primaryData[primaryIndex + 3];
          primaryIsWhite = pR >= whiteThreshold && pG >= whiteThreshold && pB >= whiteThreshold;
        } else {
          pA = 0; // Explicitly set alpha to 0 if out of bounds
        }

        // --- Comparison Pixel Check ---
        let cR = 255,
          cG = 255,
          cB = 255,
          cA = 0; // Default: transparent white
        let compareIsWhite = true;
        // Check if current (x, y) is within the bounds of the comparison canvas
        if (compareData && x < compareCanvasWidth && y < compareCanvasHeight) {
          const compareIndex = (y * compareCanvasWidth + x) * 4;
          cR = compareData[compareIndex];
          cG = compareData[compareIndex + 1];
          cB = compareData[compareIndex + 2];
          cA = compareData[compareIndex + 3];
          compareIsWhite = cR >= whiteThreshold && cG >= whiteThreshold && cB >= whiteThreshold;
        } else {
          cA = 0; // Explicitly set alpha to 0 if out of bounds
        }

        // --- Determine Result Pixel Color ---
        if (!primaryIsWhite && !compareIsWhite) {
          // Both have content: Use MIX_COLOR (black)
          resultData[resultIndex] = MIX_COLOR.r;
          resultData[resultIndex + 1] = MIX_COLOR.g;
          resultData[resultIndex + 2] = MIX_COLOR.b;
          resultData[resultIndex + 3] = Math.max(pA, cA); // Use the stronger alpha
        } else if (!primaryIsWhite && compareIsWhite) {
          // Only primary has content: Use mainColor
          resultData[resultIndex] = mainRgb.r;
          resultData[resultIndex + 1] = mainRgb.g;
          resultData[resultIndex + 2] = mainRgb.b;
          resultData[resultIndex + 3] = pA;
        } else if (primaryIsWhite && !compareIsWhite) {
          // Only comparison has content: Use comparisonColor
          resultData[resultIndex] = compareRgb.r;
          resultData[resultIndex + 1] = compareRgb.g;
          resultData[resultIndex + 2] = compareRgb.b;
          resultData[resultIndex + 3] = cA;
        } else {
          // Both are white/transparent: Make transparent
          resultData[resultIndex + 3] = 0;
        }
      }
    }

    // Draw the final result image data onto the visible canvas
    resultCtx.putImageData(resultImageData, 0, 0);
  };

  // Function to render a PDF page onto a specified canvas
  const renderPageToCanvas = (
    pdfPage: PDFPageProxy | null,
    canvasRef: React.RefObject<HTMLCanvasElement>,
    shouldRender: boolean,
    setHasRendered: (value: boolean) => void,
  ) => {
    if (!pdfPage || !canvasRef.current || !shouldRender) return;

    let isMounted = true;
    let currentRenderTask: RenderTask | null = null;

    const currentViewport = pdfPage.getViewport({ scale, rotation, dontFlip: false });
    const canvasSetup = setupCanvas(canvasRef.current, currentViewport);

    if (!canvasSetup || !canvasSetup.ctx) return;

    const { ctx, scale: renderScale } = canvasSetup; // Use the scale returned by setupCanvas
    ctx.scale(renderScale, renderScale); // Apply scaling for rendering

    const renderContext = { canvasContext: ctx, viewport: currentViewport };

    const render = async () => {
      try {
        // Clear previous rendering
        ctx.clearRect(0, 0, canvasRef.current!.width / renderScale, canvasRef.current!.height / renderScale);

        currentRenderTask = pdfPage.render(renderContext);
        await currentRenderTask.promise;
        if (isMounted) {
          setHasRendered(true);
          // Trigger comparison after rendering is complete
          compareAndGenerateResult();
        }
      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error(`Error rendering PDF page ${pageNumber}:`, error);
        }
      }
    };

    render();

    // Cleanup function
    return () => {
      isMounted = false;
      currentRenderTask?.cancel();
    };
  };

  // Effect to render the primary page
  useEffect(() => {
    return renderPageToCanvas(page, primaryCanvasRef, shouldRenderPrimary, setHasRenderedPrimary);
  }, [page, scale, rotation, shouldRenderPrimary]); // Dependencies for primary rendering

  // Effect to render the comparison page
  useEffect(() => {
    // Only render if comparePage exists
    if (comparePage) {
      return renderPageToCanvas(comparePage, compareCanvasRef, shouldRenderCompare, setHasRenderedCompare);
    } else {
      // If comparePage becomes null, ensure comparison runs with only primary
      setHasRenderedCompare(false); // Reset compare status
      compareAndGenerateResult(); // Trigger comparison with only primary rendered
      return () => {}; // No cleanup needed if no compare page
    }
  }, [comparePage, scale, rotation, shouldRenderCompare]); // Dependencies for comparison rendering

  // Effect to re-run comparison if rendering status changes (e.g., compare page added/removed)
  useEffect(() => {
    compareAndGenerateResult();
  }, [hasRenderedPrimary, hasRenderedCompare]);

  // Effect to reset rendering state when scale or rotation changes
  useEffect(() => {
    setHasRenderedPrimary(false);
    setHasRenderedCompare(false);
    // Optionally clear the result canvas here if desired for immediate feedback
    if (resultCanvasRef.current) {
      const ctx = resultCanvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, resultCanvasRef.current.width, resultCanvasRef.current.height);
    }
  }, [rotation, scale]);

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
          {/* Hidden canvases used only for off-screen rendering and pixel access */}
          <canvas ref={primaryCanvasRef} className={classes.pageCanvas} style={{ display: 'none' }} />
          <canvas ref={compareCanvasRef} className={classes.pageCanvas} style={{ display: 'none' }} />

          {/* Visible canvas displaying the final comparison result */}
          <canvas ref={resultCanvasRef} className={classes.pageCanvas} />
        </div>
      </div>
    </div>
  );
};
