import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { Drawing } from '../../model/types/viewerSchema';
import styles from './DrawAreaLayer.module.scss';

interface DrawAreaLayerProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the PDF canvas
}

/**
 * Component for handling draw area with thick line (32px) that converts to rectangle
 */
export const DrawAreaLayer: React.FC<DrawAreaLayerProps> = ({ pageNumber, onDrawingCreated, pdfCanvasRef }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, pageRotations, drawingMode } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

  // Constant for the thick line width used for drawing (32px)
  const DRAW_AREA_LINE_WIDTH = 32;

  // Create a function to initialize the canvas with correct dimensions and context
  const initializeCanvas = () => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;

    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (parent) {
      // Use parent dimensions directly without any transforms
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    } else {
      console.warn('No parent element found for canvas');
      return null;
    }

    // Get context
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return null;
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Initialize drawing styles
    ctx.strokeStyle = drawingColor + '80'; // 50% opacity for drawing preview
    ctx.lineWidth = DRAW_AREA_LINE_WIDTH; // Fixed 32px width
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    return ctx;
  };

  // Hide canvas when not in drawArea mode
  useEffect(() => {
    if (!canvasRef.current) return;

    if (drawingMode === 'drawArea') {
      canvasRef.current.style.display = 'block';
    } else {
      canvasRef.current.style.display = 'none';
      // Reset drawing state when switching out of draw area mode
      setIsDrawing(false);
      setCurrentPath([]);
    }
  }, [drawingMode]);

  // Set up drawing canvas whenever rotation, scale, or page changes
  useEffect(() => {
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Redraw any current path after rotation or scaling
    if (isDrawing && currentPath.length > 1) {
      ctx.beginPath();

      // Start from the first point
      const firstPoint = currentPath[0];
      ctx.moveTo(firstPoint.x, firstPoint.y);

      // Draw lines to all points
      for (let i = 1; i < currentPath.length; i++) {
        const point = currentPath[i];
        ctx.lineTo(point.x, point.y);
      }

      ctx.stroke();
    }
  }, [scale, pageNumber, rotation, isDrawing, currentPath, drawingColor]);

  // Set cursor to crosshair
  useEffect(() => {
    if (!canvasRef.current || drawingMode !== 'drawArea') return;

    const canvas = canvasRef.current;

    const handleMouseEnter = () => {
      // Force the cursor to be a crosshair
      canvas.style.cursor = 'crosshair';
    };

    canvas.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      canvas.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [drawingMode]);

  // Get raw coordinates relative to canvas
  const getRawCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    // Get mouse position relative to canvas
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    return { x, y };
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawingMode !== 'drawArea') return;

    // Initialize or reinitialize the canvas
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    // Start drawing and tracking
    setIsDrawing(true);
    setCurrentPath([{ x, y }]);

    // Start drawing
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || drawingMode !== 'drawArea') return;

    // Get or reinitialize the canvas context
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    // Add point to current path
    setCurrentPath((prevPath) => {
      const newPath = [...prevPath, { x, y }];

      // Redraw the entire path to ensure it's visible
      if (ctx && newPath.length > 1) {
        // Clear the canvas first
        const canvas = canvasRef.current;
        if (canvas) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        // Draw the complete path
        ctx.beginPath();
        ctx.moveTo(newPath[0].x, newPath[0].y);

        for (let i = 1; i < newPath.length; i++) {
          ctx.lineTo(newPath[i].x, newPath[i].y);
        }

        ctx.stroke();
      }

      return newPath;
    });
  };

  const endDrawing = () => {
    if (!isDrawing || drawingMode !== 'drawArea') {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    // Calculate the bounding box of the current path
    // This ensures we use the actual path points rather than potentially incorrect state variables
    let pathMinX = Infinity;
    let pathMinY = Infinity;
    let pathMaxX = -Infinity;
    let pathMaxY = -Infinity;

    // Find the min/max coordinates from the current path
    currentPath.forEach((point) => {
      pathMinX = Math.min(pathMinX, point.x);
      pathMinY = Math.min(pathMinY, point.y);
      pathMaxX = Math.max(pathMaxX, point.x);
      pathMaxY = Math.max(pathMaxY, point.y);
    });

    // Account for line width when calculating the bounding box
    // Add half the line width to each edge of the bounding box
    const halfLineWidth = DRAW_AREA_LINE_WIDTH / 2;
    pathMinX = Math.max(0, pathMinX - halfLineWidth);
    pathMinY = Math.max(0, pathMinY - halfLineWidth);
    pathMaxX = Math.min(canvas.width, pathMaxX + halfLineWidth);
    pathMaxY = Math.min(canvas.height, pathMaxY + halfLineWidth);

    // Check if the bounding box is too small
    const width = pathMaxX - pathMinX;
    const height = pathMaxY - pathMinY;

    if (width < 10 || height < 10) {
      setIsDrawing(false);
      setCurrentPath([]);

      // Clear the canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Add padding for the bounding box for image capture
    const padding = 10;
    const boundingBox = {
      left: Math.max(0, pathMinX - padding),
      top: Math.max(0, pathMinY - padding),
      width: Math.min(canvas.width - pathMinX + padding, pathMaxX - pathMinX + padding * 2),
      height: Math.min(canvas.height - pathMinY + padding, pathMaxY - pathMinY + padding * 2),
    };

    // Capture the image
    const image = captureDrawingImage(
      pdfCanvasRef?.current || null,
      canvas,
      boundingBox,
      false, // Set to false to only capture the PDF background
    );

    // Normalize the points to scale 1 and 0 degrees rotation
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      { x: pathMinX, y: pathMinY },
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      { x: pathMaxX, y: pathMaxY },
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    // Create a new DrawArea object
    const newDrawArea: Drawing = {
      id: '',
      type: 'drawArea',
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth / scale, // Use context.drawingLineWidth for the final rectangle
      },
      pageNumber,
      image,
      boundingBox: {
        left: normalizedStartPoint.x,
        top: normalizedStartPoint.y,
        right: normalizedEndPoint.x,
        bottom: normalizedEndPoint.y,
      },
    };

    // Call the callback with the new drawing
    onDrawingCreated(newDrawArea);

    // Reset drawing state
    setIsDrawing(false);
    setCurrentPath([]);

    // Clear the canvas since the drawing area will be rendered by the CompleteDrawings component
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawAreaCanvas}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      data-testid='draw-area-canvas'
    />
  );
};
