import { useEffect, useRef, useContext, forwardRef, useMemo } from 'react';
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
  renderPinSelection,
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

  const { state } = useContext(ViewerContext);
  const { scale, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  // Filter drawings for this page - use useMemo to prevent recreation on every render
  const pageDrawings = useMemo(() => {
    return drawings.filter((drawing) => drawing.pageNumber === pageNumber);
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

  const nonImageDrawings = useMemo(() => pageDrawings.filter((d) => d.type !== 'image'), [pageDrawings]);

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
      const canvas = typeof canvasRef === 'function' ? null : canvasRef?.current;
      if (canvas) renderCanvas();
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
  }, [imageDrawings, canvasRef]);

  // Function to render the canvas
  const renderCanvas = () => {
    const canvas = typeof canvasRef === 'function' ? null : canvasRef?.current;
    if (!canvas) return;

    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (!parent) return;

    // Get parent dimensions
    const parentWidth = parent.clientWidth;
    const parentHeight = parent.clientHeight;

    // Validate dimensions - avoid zero-sized canvas
    if (parentWidth <= 0 || parentHeight <= 0) {
      // ResizeObserver will trigger a render when dimensions are available
      return;
    }

    // Use parent dimensions without any transforms
    canvas.width = parentWidth;
    canvas.height = parentHeight;

    // Clear canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // First, render all images
    imageDrawings.forEach((imgDrawing, index) => {
      // Generate the same key used in loading
      const imageKey = imgDrawing.id || `temp-image-${index}`;

      // Skip if no image data
      if (!imgDrawing.image) return;

      // Skip if image is still loading
      if (loadingImagesRef.current.has(imageKey)) return;

      // Skip if image failed to load
      if (!imagesRef.current.has(imageKey)) return;

      const img = imagesRef.current.get(imageKey)!;

      try {
        // Transform the start point (top-left position)
        const transformedStartPoint = transformCoordinates(
          imgDrawing.startPoint.x,
          imgDrawing.startPoint.y,
          canvas.width,
          canvas.height,
          scale,
          rotation,
        );

        // Transform the end point (bottom-right position)
        const transformedEndPoint = transformCoordinates(
          imgDrawing.endPoint.x,
          imgDrawing.endPoint.y,
          canvas.width,
          canvas.height,
          scale,
          rotation,
        );

        // Calculate display width/height from the transformed points
        const displayWidth = Math.abs(transformedEndPoint.x - transformedStartPoint.x);
        const displayHeight = Math.abs(transformedEndPoint.y - transformedStartPoint.y);

        // Draw image at its position (use left-most and top-most points)
        const drawX = Math.min(transformedStartPoint.x, transformedEndPoint.x);
        const drawY = Math.min(transformedStartPoint.y, transformedEndPoint.y);

        ctx.drawImage(img, drawX, drawY, displayWidth, displayHeight);
      } catch {
        // Silent fail for any drawing errors
      }
    });

    // Then render all other drawings on top
    nonImageDrawings.forEach((drawing) => {
      switch (drawing.type) {
        case 'freehand':
          renderFreehandPath(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'rectangle':
          renderRectangle(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'extensionLine': {
          // Transform pin position with rotation
          const { x, y } = transformCoordinates(
            drawing.position.x,
            drawing.position.y,
            canvas.width,
            canvas.height,
            scale,
            rotation,
          );

          // If there's a bend point, transform it too
          if (drawing.bendPoint) {
            const transformedBend = transformCoordinates(
              drawing.bendPoint.x,
              drawing.bendPoint.y,
              canvas.width,
              canvas.height,
              scale,
              rotation,
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
          renderLine(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'drawArea':
          renderDrawArea(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'textUnderline':
          renderTextUnderline(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'textCrossedOut':
          renderTextCrossedOut(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'textHighlight':
          renderTextHighlight(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'textArea':
          renderTextArea(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'RectSelection':
          // Render RectSelection as a simple dashed blue rectangle
          // Need to provide a style object as RectSelection doesn't have one
          renderRectangle(
            ctx,
            {
              ...drawing,
              style: {
                strokeColor: '#0000FF', // Blue
                strokeWidth: 1 / scale, // Normalize width
                lineDash: [4, 4], // Dashed line
              },
            } as any, // Cast to satisfy renderRectangle, which expects a style prop
            canvas.width,
            canvas.height,
            scale,
            rotation,
          );
          break;

        case 'PinSelection':
          renderPinSelection(ctx, drawing, canvas.width, canvas.height, scale, rotation);
          break;

        case 'misc': {
          // Render all components of the misc drawing
          drawing.pathes.forEach((path) => {
            renderFreehandPath(ctx, path, canvas.width, canvas.height, scale, rotation);
          });

          drawing.rectangles.forEach((rect) => {
            renderRectangle(ctx, rect, canvas.width, canvas.height, scale, rotation);
          });

          drawing.extensionLines.forEach((extensionLine) => {
            const { x, y } = transformCoordinates(
              extensionLine.position.x,
              extensionLine.position.y,
              canvas.width,
              canvas.height,
              scale,
              rotation,
            );

            if (extensionLine.bendPoint) {
              const transformedBend = transformCoordinates(
                extensionLine.bendPoint.x,
                extensionLine.bendPoint.y,
                canvas.width,
                canvas.height,
                scale,
                rotation,
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

          drawing.lines.forEach((line) => {
            renderLine(ctx, line, canvas.width, canvas.height, scale, rotation);
          });

          drawing.textAreas.forEach((textArea) => {
            renderTextArea(ctx, textArea, canvas.width, canvas.height, scale, rotation);
          });
          break;
        }
      }
    });
  };

  // Set up a ResizeObserver to detect when parent dimensions change
  useEffect(() => {
    const canvas = typeof canvasRef === 'function' ? null : canvasRef?.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    // Set up the observer
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          // Parent now has valid dimensions, render the canvas
          renderCanvas();
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
  }, [canvasRef]);

  // Call renderCanvas whenever relevant props change
  useEffect(() => {
    renderCanvas();
  }, [pageDrawings, scale, pageNumber, rotation]);

  return <canvas ref={canvasRef} className={styles.drawingsCanvas} data-testid='complete-drawings-canvas' />;
});

export default CompleteDrawings;
