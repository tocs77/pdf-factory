import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { Drawing, DrawingStyle } from '../../model/types/viewerSchema';
import styles from './DrawingComponent.module.scss';

interface DrawingComponentProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the PDF canvas
}

/**
 * Component for handling freehand drawing
 */
export const DrawingComponent: React.FC<DrawingComponentProps> = ({ pageNumber, onDrawingCreated, pdfCanvasRef }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  const [allPaths, setAllPaths] = useState<Array<{ x: number; y: number }[]>>([]);
  const [pathStyles, setPathStyles] = useState<DrawingStyle[]>([]); // Styles for each path
  const [currentStyle, setCurrentStyle] = useState<DrawingStyle>({
    strokeColor: drawingColor,
    strokeWidth: drawingLineWidth,
  }); // Style for the current path
  const [isMultiStrokeMode, setIsMultiStrokeMode] = useState(false);

  // Update current style when drawingColor changes
  useEffect(() => {
    setCurrentStyle((prev) => ({
      ...prev,
      strokeColor: drawingColor,
    }));
  }, [drawingColor]);

  // Update current style when drawingLineWidth changes
  useEffect(() => {
    setCurrentStyle((prev) => ({
      ...prev,
      strokeWidth: drawingLineWidth,
    }));
  }, [drawingLineWidth]);

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

    return ctx;
  };

  // Draw all paths on the canvas
  const redrawAllPaths = (ctx: CanvasRenderingContext2D) => {
    if (!canvasRef.current) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw all saved paths with their styles
    allPaths.forEach((path, index) => {
      if (path.length < 2) return;

      // Get the style for this path
      const style = pathStyles[index] || { strokeColor: drawingColor, strokeWidth: drawingLineWidth };

      ctx.strokeStyle = style.strokeColor;
      ctx.lineWidth = style.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);

      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(path[i].x, path[i].y);
      }

      ctx.stroke();
    });

    // Draw current path if active
    if (currentPath.length > 1) {
      ctx.strokeStyle = currentStyle.strokeColor;
      ctx.lineWidth = currentStyle.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(currentPath[0].x, currentPath[0].y);

      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }

      ctx.stroke();
    }
  };

  // Set up drawing canvas whenever rotation, scale, or page changes
  useEffect(() => {
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Redraw all paths after rotation or scaling
    redrawAllPaths(ctx);
  }, [scale, pageNumber, rotation, allPaths, currentPath, pathStyles, currentStyle]);

  // Set cursor to crosshair
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    const handleMouseEnter = () => {
      // Force the cursor to be a crosshair
      canvas.style.cursor = 'crosshair';
    };

    canvas.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      canvas.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  // Listen for ESC key to cancel drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isDrawing || isMultiStrokeMode)) {
        cancelDrawing();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawing, isMultiStrokeMode]);

  // Cancel current drawing
  const cancelDrawing = () => {
    setIsDrawing(false);
    setCurrentPath([]);
    setAllPaths([]);
    setPathStyles([]);
    setIsMultiStrokeMode(false);

    // Clear the canvas
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

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

  // Finish drawing and save all paths as one drawing
  const finishDrawing = () => {
    if ((!isMultiStrokeMode && !isDrawing) || (allPaths.length === 0 && currentPath.length < 2)) {
      cancelDrawing();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      cancelDrawing();
      return;
    }

    // Save current path if it has enough points
    let paths = [...allPaths];
    let styles = [...pathStyles];

    if (currentPath.length >= 2) {
      paths = [...paths, [...currentPath]];
      styles = [...styles, { ...currentStyle }];
    }

    if (paths.length === 0) {
      cancelDrawing();
      return;
    }

    // Normalize all points to scale 1 and 0 degrees rotation
    const normalizedPaths = paths.map((path) =>
      path.map((point) => normalizeCoordinatesToZeroRotation(point, canvas.width, canvas.height, scale, rotation)),
    );

    // Calculate bounding box of all drawings
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = 0;
    let maxY = 0;

    for (const path of paths) {
      for (const point of path) {
        minX = Math.min(minX, point.x);
        minY = Math.min(minY, point.y);
        maxX = Math.max(maxX, point.x);
        maxY = Math.max(maxY, point.y);
      }
    }

    // Add padding to the bounding box
    const padding = 10;
    minX = Math.max(0, minX - padding);
    minY = Math.max(0, minY - padding);
    maxX = Math.min(canvas.width, maxX + padding);
    maxY = Math.min(canvas.height, maxY + padding);

    // Capture drawing as image
    const boundingBox = {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    const image = captureDrawingImage(pdfCanvasRef?.current || null, canvas, boundingBox);

    // Create a new drawing object with styles for each path
    const newDrawing: Drawing = {
      type: 'freehand',
      paths: normalizedPaths,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth / scale, // Store line width at scale 1
      },
      pathStyles: styles.map((style) => ({
        strokeColor: style.strokeColor,
        strokeWidth: style.strokeWidth / scale, // Store line width at scale 1
      })),
      pageNumber,
      image,
    };

    // Call the callback with the new drawing
    onDrawingCreated(newDrawing);

    // Reset state
    setIsDrawing(false);
    setCurrentPath([]);
    setAllPaths([]);
    setPathStyles([]);
    setIsMultiStrokeMode(false);

    // Clear the canvas since the drawing will be rendered by the CompleteDrawings component
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Drawing handlers
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Initialize or reinitialize the canvas
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    setIsDrawing(true);
    setCurrentPath([{ x, y }]);

    if (!isMultiStrokeMode) {
      setIsMultiStrokeMode(true);
    }

    // Start drawing
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = currentStyle.strokeColor;
    ctx.lineWidth = currentStyle.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    // Get or reinitialize the canvas context
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    // Add point to current path
    setCurrentPath((prevPath) => {
      const newPath = [...prevPath, { x, y }];

      // Redraw the entire canvas with all paths and current path
      if (ctx && canvasRef.current) {
        redrawAllPaths(ctx);
      }

      return newPath;
    });
  };

  const endDrawing = () => {
    if (!isDrawing || drawingMode !== 'freehand') {
      return;
    }

    // If the path is valid, add it to allPaths
    if (currentPath.length >= 2) {
      setAllPaths((prevPaths) => [...prevPaths, [...currentPath]]);
      setPathStyles((prevStyles) => [...prevStyles, { ...currentStyle }]);
    }

    // Clear current path but stay in multi-stroke mode
    setIsDrawing(false);
    setCurrentPath([]);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={styles.drawingCanvas}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        data-testid='freehand-drawing-canvas'
      />
      {isMultiStrokeMode && (
        <div className={styles.controlsContainer}>
          <div className={styles.finishButtonContainer}>
            <button className={styles.finishButton} onClick={finishDrawing}>
              Finish
            </button>
          </div>
        </div>
      )}
    </>
  );
};
