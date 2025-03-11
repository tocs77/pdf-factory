import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { Drawing } from '../../model/types/viewerSchema';
import styles from './DrawingComponent.module.scss';

interface DrawingComponentProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
}

/**
 * Component for handling freehand drawing
 */
export const DrawingComponent: React.FC<DrawingComponentProps> = ({ pageNumber, onDrawingCreated }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<{ x: number; y: number }[]>([]);

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
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    return ctx;
  };

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
  }, [scale, pageNumber, rotation, isDrawing, currentPath, drawingColor, drawingLineWidth]);

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
    // Initialize or reinitialize the canvas
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);

    setIsDrawing(true);
    setCurrentPath([{ x, y }]);

    // Start drawing
    ctx.beginPath();
    ctx.moveTo(x, y);
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
    if (!isDrawing || drawingMode !== 'freehand' || currentPath.length < 2) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setIsDrawing(false);
      setCurrentPath([]);
      return;
    }

    // Normalize all points to scale 1 and 0 degrees rotation
    const normalizedPath = currentPath.map(point => 
      normalizeCoordinatesToZeroRotation(
        point, 
        canvas.width, 
        canvas.height, 
        scale, 
        rotation
      )
    );

    // Create a new drawing object
    const newDrawing: Drawing = {
      type: 'freehand',
      points: normalizedPath,
      color: drawingColor,
      lineWidth: drawingLineWidth / scale, // Store line width at scale 1
      pageNumber
    };

    // Call the callback with the new drawing
    onDrawingCreated(newDrawing);

    // Reset state
    setIsDrawing(false);
    setCurrentPath([]);

    // Clear the canvas since the drawing will be rendered by the CompleteDrawings component
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingCanvas}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      data-testid='freehand-drawing-canvas'
    />
  );
};
