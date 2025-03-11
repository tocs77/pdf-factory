import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { Drawing } from '../../model/types/viewerSchema';
import styles from './LineDrawingLayer.module.scss';

interface LineDrawingLayerProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
}

/**
 * Component for handling straight line drawing
 */
export const LineDrawingLayer: React.FC<LineDrawingLayerProps> = ({ pageNumber, onDrawingCreated }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [isShiftKeyPressed, setIsShiftKeyPressed] = useState(false);

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
    
    return ctx;
  };

  // Track shift key state
  useEffect(() => {
    if (drawingMode !== 'line') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftKeyPressed(true);
        // Redraw with constraints if we're in the middle of drawing
        if (isDrawing && startPoint && endPoint) {
          redrawWithConstraints();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftKeyPressed(false);
        // Redraw without constraints if we're in the middle of drawing
        if (isDrawing && startPoint && endPoint) {
          redrawWithoutConstraints();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [drawingMode, isDrawing, startPoint, endPoint]);

  // Helper to redraw with angle constraints when shift is pressed
  const redrawWithConstraints = () => {
    if (!startPoint || !endPoint || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Calculate constrained end point
    const constrainedEnd = getConstrainedEndPoint(startPoint, endPoint);

    // Draw the line
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(constrainedEnd.x, constrainedEnd.y);
    ctx.stroke();
  };

  // Helper to redraw without constraints
  const redrawWithoutConstraints = () => {
    if (!startPoint || !endPoint || !canvasRef.current) return;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw the line without constraints
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    ctx.lineTo(endPoint.x, endPoint.y);
    ctx.stroke();
  };

  // Constrain endpoint to 0, 45, or 90 degrees
  const getConstrainedEndPoint = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    
    // Calculate angle in radians
    const angle = Math.atan2(dy, dx);
    
    // Convert to degrees and normalize to 0-360
    let degrees = (angle * 180) / Math.PI;
    if (degrees < 0) degrees += 360;
    
    // Find closest constraint angle (0, 45, 90, 135, 180, 225, 270, 315)
    const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
    const closestAngle = snapAngles.reduce((prev, curr) => {
      return (Math.abs(curr - degrees) < Math.abs(prev - degrees)) ? curr : prev;
    });
    
    // Calculate distance/length of the line
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Convert constrained angle back to radians
    const constrainedRadians = (closestAngle * Math.PI) / 180;
    
    // Calculate new endpoint
    return {
      x: start.x + distance * Math.cos(constrainedRadians),
      y: start.y + distance * Math.sin(constrainedRadians)
    };
  };

  // Set up drawing canvas whenever rotation, scale, or page changes
  useEffect(() => {
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Redraw the line if we're in the process of drawing
    if (isDrawing && startPoint && endPoint) {
      ctx.beginPath();
      ctx.moveTo(startPoint.x, startPoint.y);
      
      if (isShiftKeyPressed) {
        // Draw with constraints
        const constrainedEnd = getConstrainedEndPoint(startPoint, endPoint);
        ctx.lineTo(constrainedEnd.x, constrainedEnd.y);
      } else {
        // Draw without constraints
        ctx.lineTo(endPoint.x, endPoint.y);
      }
      
      ctx.stroke();
    }
  }, [scale, pageNumber, rotation, isDrawing, startPoint, endPoint, drawingColor, drawingLineWidth, isShiftKeyPressed]);

  // Hide the canvas when drawing mode is not 'line'
  useEffect(() => {
    if (!canvasRef.current) return;
    
    if (drawingMode === 'line') {
      canvasRef.current.style.display = 'block';
    } else {
      canvasRef.current.style.display = 'none';
      // Reset drawing state when switching out of line mode
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
    }
  }, [drawingMode]);

  // Set cursor to crosshair
  useEffect(() => {
    if (!canvasRef.current || drawingMode !== 'line') return;

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
    if (drawingMode !== 'line') return;
    
    // Initialize or reinitialize the canvas
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Get raw coordinates
    const coords = getRawCoordinates(e.clientX, e.clientY);
    
    setIsDrawing(true);
    setStartPoint(coords);
    setEndPoint(coords); // Initially, end point is same as start point
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || drawingMode !== 'line' || !startPoint) return;

    // Get or reinitialize the canvas context
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;

    // Get raw coordinates for the current mouse position
    const currentPoint = getRawCoordinates(e.clientX, e.clientY);
    setEndPoint(currentPoint);

    // Clear the canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Draw the line from start point to current point
    ctx.beginPath();
    ctx.moveTo(startPoint.x, startPoint.y);
    
    if (isShiftKeyPressed) {
      // Draw with constraints
      const constrainedEnd = getConstrainedEndPoint(startPoint, currentPoint);
      ctx.lineTo(constrainedEnd.x, constrainedEnd.y);
    } else {
      // Draw without constraints
      ctx.lineTo(currentPoint.x, currentPoint.y);
    }
    
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing || drawingMode !== 'line' || !startPoint || !endPoint) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      return;
    }

    // Get the final end point (constrained if shift is pressed)
    const finalEndPoint = isShiftKeyPressed
      ? getConstrainedEndPoint(startPoint, endPoint)
      : endPoint;

    // Don't save if start and end points are too close (just a click)
    const dx = finalEndPoint.x - startPoint.x;
    const dy = finalEndPoint.y - startPoint.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 5) { // Minimum line length of 5 pixels
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      
      // Clear the canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Normalize the points to scale 1 and 0 degrees rotation
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      startPoint, 
      canvas.width, 
      canvas.height, 
      scale, 
      rotation
    );

    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      finalEndPoint, 
      canvas.width, 
      canvas.height, 
      scale, 
      rotation
    );

    // Create a new line object with normalized coordinates
    const newLine: Drawing = {
      id: '',
      type: 'line',
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      color: drawingColor,
      lineWidth: drawingLineWidth / scale, // Store line width at scale 1
      pageNumber
    };

    // Call the callback with the new drawing
    onDrawingCreated(newLine);

    // Reset state
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);

    // Clear the canvas since the line will be rendered by the CompleteDrawings component
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={styles.lineDrawingCanvas}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      data-testid='line-drawing-canvas'
    />
  );
}; 