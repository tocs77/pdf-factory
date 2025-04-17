import { useEffect, useRef, useContext, forwardRef, useMemo, useLayoutEffect } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { transformCoordinates } from '../../utils/rotationUtils';
import {
  renderFreehandPath,
  renderRectangle,
  renderLine,
  renderDrawArea,
  renderTextUnderline,
  renderTextCrossedOut,
  renderTextHighlight,
  renderTextArea,
  renderpinSelection,
} from '../../utils/drawingRenderers';
import { renderExtensionLine } from '../../utils/extensionLineRenderer';
import { Drawing, ImageAnnotation, DrawingMisc } from '../../model/types/viewerSchema';
import styles from './CompleteDrawings.module.scss';

interface CompleteDrawingsProps {
  pageNumber: number;
  drawings: Drawing[];
}

/**
 * Component to display completed drawings and rectangles
 * This component is always visible, even when text layer is enabled
 */
const CompleteDrawings = forwardRef<HTMLCanvasElement, CompleteDrawingsProps>(({ pageNumber, drawings }, ref) => {
  // Use the forwarded ref if provided, otherwise use a local ref
  const internalRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = ref || internalRef;
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const loadingImagesRef = useRef<Set<string>>(new Set());
  const currentScaleRef = useRef<number>(1);
  const currentRotationRef = useRef<number>(0);
  const lastDrawingsRef = useRef<Drawing[]>([]);
  const lastRenderTimeRef = useRef<number>(0);
  const renderPendingRef = useRef<boolean>(false);
  const isRenderingStoredDrawingsRef = useRef<boolean>(false);

  const { state } = useContext(ViewerContext);
  const { scale, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  // Ensure scale and rotation are updated in refs
  useLayoutEffect(() => {
    currentScaleRef.current = scale;
  }, [scale]);

  useLayoutEffect(() => {
    currentRotationRef.current = rotation;
  }, [rotation]);

  // Track scale/rotation changes
  const prevScaleRef = useRef(scale);
  const prevRotationRef = useRef(rotation);

  useLayoutEffect(() => {
    const needsUpdate = prevScaleRef.current !== scale || prevRotationRef.current !== rotation;

    if (prevScaleRef.current !== scale) {
      prevScaleRef.current = scale;
    }

    if (prevRotationRef.current !== rotation) {
      prevRotationRef.current = rotation;
    }

    if (needsUpdate) {
      // Force canvas element to remain visible after scale/rotation changes
      const canvas = typeof canvasRef === 'function' ? null : canvasRef?.current;
      if (canvas) {
        // Ensure canvas stays visible
        ensureCanvasStyle(canvas);

        // Force a render now with the latest information
        if (drawings.length > 0 || lastDrawingsRef.current.length > 0) {
          scheduleRender();
        }
      }
    }
  }, [scale, rotation, drawings]);

  // Store drawings in ref for persistence between renders
  useEffect(() => {
    if (drawings && drawings.length > 0) {
      // Deep copy to ensure we don't have reference issues
      const drawingsCopy = drawings.map((drawing) => ({ ...drawing }));
      lastDrawingsRef.current = drawingsCopy;
    }
  }, [drawings]);

  // Filter drawings for this page - use useMemo to prevent recreation on every render
  const pageDrawings = useMemo(() => {
    // Use most recent non-empty drawings data
    const drawingsToFilter = drawings.length > 0 ? drawings : lastDrawingsRef.current;
    const filtered = drawingsToFilter.filter((drawing) => drawing.pageNumber === pageNumber);
    return filtered;
  }, [drawings, pageNumber]);

  // Extract all images from both direct image drawings and nested in misc drawings
  const imageDrawings = useMemo(() => {
    const directImageDrawings = pageDrawings.filter((d) => d.type === 'image') as ImageAnnotation[];

    // Extract images from DrawingMisc objects
    const nestedImages: ImageAnnotation[] = [];
    pageDrawings.forEach((drawing) => {
      if (drawing.type === 'misc') {
        const miscDrawing = drawing as DrawingMisc;
        if (miscDrawing.images && miscDrawing.images.length > 0) {
          nestedImages.push(...miscDrawing.images);
        }
      }
    });

    return [...directImageDrawings, ...nestedImages];
  }, [pageDrawings]);

  // Get non-image drawings, including specialized types
  const nonImageDrawings = useMemo(() => {
    // Make sure we include all drawing types except images
    return pageDrawings.filter(
      (d) =>
        d.type !== 'image' &&
        // Verify we preserve these specific types
        (d.type === 'rectangle' ||
          d.type === 'rectSelection' ||
          d.type === 'pinSelection' ||
          d.type === 'drawArea' ||
          d.type === 'freehand' ||
          d.type === 'extensionLine' ||
          d.type === 'line' ||
          d.type === 'textUnderline' ||
          d.type === 'textCrossedOut' ||
          d.type === 'textHighlight' ||
          d.type === 'textArea' ||
          d.type === 'misc'),
    );
  }, [pageDrawings]);

  // Helper function to apply consistent canvas styling
  const ensureCanvasStyle = (canvas: HTMLCanvasElement) => {
    canvas.style.zIndex = '5';
    canvas.style.position = 'absolute';
    canvas.style.pointerEvents = 'none';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    // Add more specificity to prevent style override
    canvas.style.opacity = '1';
    canvas.style.visibility = 'visible';
    canvas.style.display = 'block';
  };

  // Helper to throttle renders to avoid excessive rendering
  const scheduleRender = () => {
    if (renderPendingRef.current) {
      return; // Already scheduled
    }

    renderPendingRef.current = true;
    const now = Date.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    const delay = Math.max(0, 16 - timeSinceLastRender); // Min 16ms between renders (60fps)

    setTimeout(() => {
      requestAnimationFrame(() => {
        renderPendingRef.current = false;
        lastRenderTimeRef.current = Date.now();
        // Reset the stored drawings flag to ensure we start fresh
        isRenderingStoredDrawingsRef.current = false;
        renderCanvas();
      });
    }, delay);
  };

  // Load images without setState to avoid render loops
  useEffect(() => {
    // Skip if there are no images
    if (imageDrawings.length === 0) {
      imagesRef.current = new Map();
      loadingImagesRef.current = new Set();
      return;
    }

    // Clear existing loading state
    loadingImagesRef.current = new Set();

    // Function to re-render after image loads
    const triggerRender = () => {
      scheduleRender();
    };

    // Process each image annotation
    imageDrawings.forEach((imgDrawing, index) => {
      // Generate a consistent key for this image
      const imageKey = imgDrawing.id || `temp-image-${index}`;

      // Skip if no image data
      if (!imgDrawing.image) return;

      // Skip if already loaded
      if (imagesRef.current.has(imageKey)) return;

      // Start loading the image
      loadingImagesRef.current.add(imageKey);

      const img = new Image();

      img.onload = () => {
        imagesRef.current.set(imageKey, img);
        loadingImagesRef.current.delete(imageKey);
        triggerRender();
      };

      img.onerror = () => {
        loadingImagesRef.current.delete(imageKey);
        triggerRender();
      };

      img.src = imgDrawing.image;
    });
  }, [imageDrawings]);

  // Function to render the canvas
  const renderCanvas = () => {
    // Use the current scale and rotation from refs to avoid stale values
    const currentScale = currentScaleRef.current;
    const currentRotation = currentRotationRef.current;

    // Get the canvas handle
    const canvas = typeof canvasRef === 'function' ? null : canvasRef?.current;
    if (!canvas) {
      return;
    }

    // Ensure canvas stays visible
    ensureCanvasStyle(canvas);

    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (!parent) {
      return;
    }

    // Get parent dimensions
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;

    // Validate dimensions - avoid zero-sized canvas
    if (parentWidth <= 0 || parentHeight <= 0) {
      // ResizeObserver will trigger a render when dimensions are available
      return;
    }

    // Track if we need to resize the canvas
    const needsResize = canvas.width !== parentWidth || canvas.height !== parentHeight;

    if (needsResize) {
      canvas.width = parentWidth;
      canvas.height = parentHeight;
    }

    // Get drawing context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    // Determine what drawings to use - avoid recursive calls
    let currentImageDrawings = imageDrawings;
    let currentNonImageDrawings = nonImageDrawings;

    // Check if we need to use stored drawings
    const hasCurrentDrawings =
      (currentImageDrawings && currentImageDrawings.length > 0) ||
      (currentNonImageDrawings && currentNonImageDrawings.length > 0);

    // Only use stored drawings if:
    // 1. We don't have current drawings
    // 2. We're not already trying to render stored drawings (prevents recursion)
    // 3. We have stored drawings to use
    if (!hasCurrentDrawings && !isRenderingStoredDrawingsRef.current && lastDrawingsRef.current.length > 0) {
      // Mark that we're now rendering stored drawings to prevent recursion
      isRenderingStoredDrawingsRef.current = true;

      // Filter stored drawings for this page
      const storedPageDrawings = lastDrawingsRef.current.filter((d) => d.pageNumber === pageNumber);

      // Extract images and non-images from stored drawings - ensure we capture all drawing types
      currentImageDrawings = storedPageDrawings.filter((d) => d.type === 'image') as ImageAnnotation[];

      // Make sure we include ALL specialized drawing types
      currentNonImageDrawings = storedPageDrawings.filter(
        (d) =>
          d.type !== 'image' &&
          // Explicitly include these types
          (d.type === 'rectangle' ||
            d.type === 'rectSelection' ||
            d.type === 'pinSelection' ||
            d.type === 'drawArea' ||
            d.type === 'freehand' ||
            d.type === 'extensionLine' ||
            d.type === 'line' ||
            d.type === 'textUnderline' ||
            d.type === 'textCrossedOut' ||
            d.type === 'textHighlight' ||
            d.type === 'textArea' ||
            d.type === 'misc'),
      );

      // Also extract nested images from misc drawings
      const nestedImages: ImageAnnotation[] = [];
      storedPageDrawings.forEach((drawing) => {
        if (drawing.type === 'misc') {
          const miscDrawing = drawing as DrawingMisc;
          if (miscDrawing.images && miscDrawing.images.length > 0) {
            nestedImages.push(...miscDrawing.images);
          }
        }
      });

      // Add nested images to the image drawings
      currentImageDrawings = [...currentImageDrawings, ...nestedImages];
    }

    // If we don't have any drawings to render after trying stored drawings, just return
    if (
      (!currentImageDrawings || currentImageDrawings.length === 0) &&
      (!currentNonImageDrawings || currentNonImageDrawings.length === 0)
    ) {
      return;
    }

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // First, render all images
    if (currentImageDrawings && currentImageDrawings.length > 0) {
      currentImageDrawings.forEach((imgDrawing, index) => {
        // Generate the same key used in loading
        const imageKey = imgDrawing.id || `temp-image-${index}`;

        // Skip if no image data
        if (!imgDrawing.image) {
          return;
        }

        // Skip if image is still loading
        if (loadingImagesRef.current.has(imageKey)) {
          return;
        }

        // Skip if image failed to load
        if (!imagesRef.current.has(imageKey)) {
          return;
        }

        const img = imagesRef.current.get(imageKey)!;

        try {
          // Get the screen coordinates of the image's corner points
          // transformCoordinates already accounts for both scale and rotation
          const transformedStartPoint = transformCoordinates(
            imgDrawing.startPoint.x,
            imgDrawing.startPoint.y,
            canvas.width,
            canvas.height,
            currentScale,
            currentRotation,
          );

          const transformedEndPoint = transformCoordinates(
            imgDrawing.endPoint.x,
            imgDrawing.endPoint.y,
            canvas.width,
            canvas.height,
            currentScale,
            currentRotation,
          );

          // Calculate the image dimensions based on the normalized points after scaling
          // These dimensions include scale but not rotation effects
          const scaledWidth = Math.abs(imgDrawing.endPoint.x - imgDrawing.startPoint.x) * currentScale;
          const scaledHeight = Math.abs(imgDrawing.endPoint.y - imgDrawing.startPoint.y) * currentScale;

          // Calculate the center of the image in screen coordinates
          // This accounts for both scaling and rotation since we're using transformed points
          const centerX = (transformedStartPoint.x + transformedEndPoint.x) / 2;
          const centerY = (transformedStartPoint.y + transformedEndPoint.y) / 2;

          // Save the current canvas state
          ctx.save();

          // 1. Translate to the center of the image
          ctx.translate(centerX, centerY);

          // 2. Apply the same rotation as the page
          const rotationRadians = (currentRotation * Math.PI) / 180;
          ctx.rotate(rotationRadians);

          // 3. Draw the image centered at the current origin
          // Using the scaled dimensions ensures the image size adapts to zoom level
          ctx.drawImage(
            img,
            -scaledWidth / 2, // Center horizontally
            -scaledHeight / 2, // Center vertically
            scaledWidth,
            scaledHeight,
          );

          // Restore the canvas state
          ctx.restore();
        } catch (error) {
          console.error('Error rendering image:', error);
        }
      });
    }

    // Then render all other drawings on top
    if (currentNonImageDrawings && currentNonImageDrawings.length > 0) {
      currentNonImageDrawings.forEach((drawing) => {
        try {
          // Add type check for debugging
          if (!drawing || !drawing.type) {
            console.error('Invalid drawing object:', drawing);
            return;
          }

          switch (drawing.type) {
            case 'freehand':
              renderFreehandPath(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'rectangle':
              renderRectangle(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'extensionLine': {
              // Transform pin position with rotation
              const { x, y } = transformCoordinates(
                drawing.position.x,
                drawing.position.y,
                canvas.width,
                canvas.height,
                currentScale,
                currentRotation,
              );

              // If there's a bend point, transform it too
              if (drawing.bendPoint) {
                const transformedBend = transformCoordinates(
                  drawing.bendPoint.x,
                  drawing.bendPoint.y,
                  canvas.width,
                  canvas.height,
                  currentScale,
                  currentRotation,
                );

                // Create a temporary pin with the transformed bend point
                const tempPin = {
                  ...drawing,
                  bendPoint: { x: transformedBend.x, y: transformedBend.y },
                };

                // Use the pin renderer utility with transformed coordinates
                renderExtensionLine(ctx, tempPin, x, y);
              } else {
                // Use the pin renderer utility with just the position
                renderExtensionLine(ctx, drawing, x, y);
              }
              break;
            }

            case 'line':
              renderLine(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'drawArea':
              renderDrawArea(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'textUnderline':
              renderTextUnderline(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'textCrossedOut':
              renderTextCrossedOut(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'textHighlight':
              renderTextHighlight(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'textArea':
              renderTextArea(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'rectSelection':
              renderDrawArea(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              break;

            case 'pinSelection':
              if (drawing.position) {
                renderpinSelection(ctx, drawing, canvas.width, canvas.height, currentScale, currentRotation);
              }
              break;

            case 'misc': {
              // Render all components of the misc drawing
              if (drawing.pathes && drawing.pathes.length > 0) {
                drawing.pathes.forEach((path) => {
                  renderFreehandPath(ctx, path, canvas.width, canvas.height, currentScale, currentRotation);
                });
              }

              if (drawing.rectangles && drawing.rectangles.length > 0) {
                drawing.rectangles.forEach((rect) => {
                  renderRectangle(ctx, rect, canvas.width, canvas.height, currentScale, currentRotation);
                });
              }

              if (drawing.extensionLines && drawing.extensionLines.length > 0) {
                drawing.extensionLines.forEach((extensionLine) => {
                  const { x, y } = transformCoordinates(
                    extensionLine.position.x,
                    extensionLine.position.y,
                    canvas.width,
                    canvas.height,
                    currentScale,
                    currentRotation,
                  );

                  if (extensionLine.bendPoint) {
                    const transformedBend = transformCoordinates(
                      extensionLine.bendPoint.x,
                      extensionLine.bendPoint.y,
                      canvas.width,
                      canvas.height,
                      currentScale,
                      currentRotation,
                    );

                    const tempPin = {
                      ...extensionLine,
                      bendPoint: { x: transformedBend.x, y: transformedBend.y },
                    };

                    renderExtensionLine(ctx, tempPin, x, y);
                  } else {
                    renderExtensionLine(ctx, extensionLine, x, y);
                  }
                });
              }

              if (drawing.lines && drawing.lines.length > 0) {
                drawing.lines.forEach((line) => {
                  renderLine(ctx, line, canvas.width, canvas.height, currentScale, currentRotation);
                });
              }

              if (drawing.textAreas && drawing.textAreas.length > 0) {
                drawing.textAreas.forEach((textArea) => {
                  renderTextArea(ctx, textArea, canvas.width, canvas.height, currentScale, currentRotation);
                });
              }
              break;
            }
          }
        } catch (error) {
          console.error('Error rendering drawing:', error);
        }
      });
    }
  };

  // Set up a ResizeObserver to detect when parent dimensions change
  useEffect(() => {
    const canvas = typeof canvasRef === 'function' ? null : canvasRef?.current;
    if (!canvas) {
      return;
    }

    // Ensure canvas is properly styled initially
    ensureCanvasStyle(canvas);

    const parent = canvas.parentElement;
    if (!parent) {
      return;
    }

    // Set up the observer
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Parent now has valid dimensions, render the canvas
          // Schedule the render with throttling
          scheduleRender();
        }
      }
    });

    // Start observing the parent element
    observer.observe(parent);
    resizeObserverRef.current = observer;

    // Cleanup observer on unmount
    return () => {
      observer.disconnect();
      resizeObserverRef.current = null;
    };
  }, [canvasRef, pageNumber]);

  // Call renderCanvas whenever relevant props change
  useEffect(() => {
    // Schedule the render with throttling
    scheduleRender();
  }, [pageDrawings, scale, pageNumber, rotation]);

  // Ensure re-render on window resize
  useEffect(() => {
    const handleResize = () => {
      scheduleRender();
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Initial render on component mount
  useEffect(() => {
    scheduleRender();
  }, []);

  return <canvas ref={canvasRef} className={styles.drawingsCanvas} data-testid='complete-drawings-canvas' />;
});

export default CompleteDrawings;
