import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import styles from './DrawAreaLayer.module.scss';

interface DrawAreaLayerProps {
  pageNumber: number;
}

/**
 * Component for handling draw area with thick line (32px) that converts to rectangle
 */
export const DrawAreaLayer: React.FC<DrawAreaLayerProps> = ({ pageNumber }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, pageRotations, drawingMode } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);
  
  // Track the bounding box of the drawing
  const [minX, setMinX] = useState<number | null>(null);
  const [minY, setMinY] = useState<number | null>(null);
  const [maxX, setMaxX] = useState<number | null>(null);
  const [maxY, setMaxY] = useState<number | null>(null);

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
      resetBoundingBox();
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

  // Reset bounding box tracking
  const resetBoundingBox = () => {
    setMinX(null);
    setMinY(null);
    setMaxX(null);
    setMaxY(null);
  };

  // Update bounding box with new point
  const updateBoundingBox = (x: number, y: number) => {
    setMinX((prev) => (prev === null || x < prev ? x : prev));
    setMinY((prev) => (prev === null || y < prev ? y : prev));
    setMaxX((prev) => (prev === null || x > prev ? x : prev));
    setMaxY((prev) => (prev === null || y > prev ? y : prev));
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
    resetBoundingBox();
    updateBoundingBox(x, y);

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

    // Update bounding box
    updateBoundingBox(x, y);

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
    if (!isDrawing || drawingMode !== 'drawArea' || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      resetBoundingBox();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || minX === null || minY === null || maxX === null || maxY === null) {
      setIsDrawing(false);
      setCurrentPath([]);
      resetBoundingBox();
      return;
    }

    // Add padding to the bounding box (half the line width)
    const padding = DRAW_AREA_LINE_WIDTH / 2;
    const boundingStartX = Math.max(0, minX - padding);
    const boundingStartY = Math.max(0, minY - padding);
    const boundingEndX = Math.min(canvas.width, maxX + padding);
    const boundingEndY = Math.min(canvas.height, maxY + padding);

    // Normalize the bounding box coordinates
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      { x: boundingStartX, y: boundingStartY }, 
      canvas.width, 
      canvas.height, 
      scale, 
      rotation
    );

    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      { x: boundingEndX, y: boundingEndY }, 
      canvas.width, 
      canvas.height, 
      scale, 
      rotation
    );

    // Create a new DrawArea object
    const newDrawArea = {
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      color: drawingColor,
      lineWidth: drawingLineWidth / scale, // Use context.drawingLineWidth for the final rectangle
      pageNumber,
      canvasDimensions: {
        width: canvas.width / scale,
        height: canvas.height / scale
      },
      rotation: rotation as 0 | 90 | 180 | 270
    };

    // Add the drawing area to the context
    dispatch({ type: 'addDrawArea', payload: newDrawArea });

    // Reset drawing state
    setIsDrawing(false);
    setCurrentPath([]);
    resetBoundingBox();

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