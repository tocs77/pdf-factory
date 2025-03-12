import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { Drawing } from '../../model/types/viewerSchema';
import styles from './LineDrawingLayer.module.scss';

interface LineDrawingLayerProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the PDF canvas
}

/**
 * Component for handling straight line drawing
 */
export const LineDrawingLayer: React.FC<LineDrawingLayerProps> = ({ pageNumber, onDrawingCreated, pdfCanvasRef }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [isShiftKeyPressed, setIsShiftKeyPressed] = useState(false);
  const [allLines, setAllLines] = useState<Array<{ startPoint: { x: number; y: number }; endPoint: { x: number; y: number } }>>([]);
  const [isMultiLineMode, setIsMultiLineMode] = useState(false);

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

  // Draw all lines on the canvas
  const redrawAllLines = (ctx: CanvasRenderingContext2D) => {
    if (!canvasRef.current) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Set drawing styles
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.lineCap = 'round';
    
    // Draw all saved lines
    for (const line of allLines) {
      ctx.beginPath();
      ctx.moveTo(line.startPoint.x, line.startPoint.y);
      ctx.lineTo(line.endPoint.x, line.endPoint.y);
      ctx.stroke();
    }
    
    // Draw current line if active
    if (startPoint && endPoint) {
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
  };

  // Track shift key state
  useEffect(() => {
    if (drawingMode !== 'line') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftKeyPressed(true);
        // Redraw with constraints if we're in the middle of drawing
        if (isDrawing && startPoint && endPoint) {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) redrawAllLines(ctx);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftKeyPressed(false);
        // Redraw without constraints if we're in the middle of drawing
        if (isDrawing && startPoint && endPoint) {
          const ctx = canvasRef.current?.getContext('2d');
          if (ctx) redrawAllLines(ctx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [drawingMode, isDrawing, startPoint, endPoint, allLines]);

  // Listen for ESC key to cancel drawing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (isDrawing || isMultiLineMode)) {
        cancelDrawing();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDrawing, isMultiLineMode]);

  // Cancel current drawing
  const cancelDrawing = () => {
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);
    setAllLines([]);
    setIsMultiLineMode(false);
    
    // Clear the canvas
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
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

    // Redraw all lines
    redrawAllLines(ctx);
  }, [scale, pageNumber, rotation, drawingColor, drawingLineWidth, isShiftKeyPressed, allLines, startPoint, endPoint]);

  // Hide the canvas when drawing mode is not 'line'
  useEffect(() => {
    if (!canvasRef.current) return;
    
    if (drawingMode === 'line') {
      canvasRef.current.style.display = 'block';
    } else {
      canvasRef.current.style.display = 'none';
      // Reset drawing state when switching out of line mode
      cancelDrawing();
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

  // Finish drawing and save all lines as one drawing
  const finishDrawing = () => {
    if ((!isMultiLineMode && !isDrawing) || (allLines.length === 0 && (!startPoint || !endPoint))) {
      cancelDrawing();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      cancelDrawing();
      return;
    }

    // Save current line if it's valid
    let lines = [...allLines];
    if (startPoint && endPoint) {
      const finalEndPoint = isShiftKeyPressed
        ? getConstrainedEndPoint(startPoint, endPoint)
        : endPoint;
        
      // Calculate distance to check if line is valid
      const dx = finalEndPoint.x - startPoint.x;
      const dy = finalEndPoint.y - startPoint.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance >= 5) { // Minimum line length of 5 pixels
        lines = [...lines, { startPoint, endPoint: finalEndPoint }];
      }
    }

    if (lines.length === 0) {
      cancelDrawing();
      return;
    }

    // Calculate bounding box for all lines
    let minX = Number.MAX_VALUE;
    let minY = Number.MAX_VALUE;
    let maxX = 0;
    let maxY = 0;
    
    for (const line of lines) {
      minX = Math.min(minX, line.startPoint.x, line.endPoint.x);
      minY = Math.min(minY, line.startPoint.y, line.endPoint.y);
      maxX = Math.max(maxX, line.startPoint.x, line.endPoint.x);
      maxY = Math.max(maxY, line.startPoint.y, line.endPoint.y);
    }

    // Add padding
    const padding = 10;
    const left = Math.max(0, minX - padding);
    const top = Math.max(0, minY - padding);
    const width = Math.min(canvas.width - left, maxX - minX + padding * 2);
    const height = Math.min(canvas.height - top, maxY - minY + padding * 2);

    // Ensure the bounding box is within canvas bounds
    const boundingBox = {
      left,
      top,
      width,
      height
    };

    // Normalize all lines to scale 1 and 0 degrees rotation
    const normalizedLines = lines.map(line => ({
      startPoint: normalizeCoordinatesToZeroRotation(
        line.startPoint, 
        canvas.width, 
        canvas.height, 
        scale, 
        rotation
      ),
      endPoint: normalizeCoordinatesToZeroRotation(
        line.endPoint, 
        canvas.width, 
        canvas.height, 
        scale, 
        rotation
      )
    }));

    // Capture the image
    const image = captureDrawingImage(
      pdfCanvasRef?.current || null,
      canvas,
      boundingBox
    );

    // Create a new line object with normalized coordinates
    const newLine: Drawing = {
      type: 'line',
      lines: normalizedLines,
      color: drawingColor,
      lineWidth: drawingLineWidth / scale, // Store line width at scale 1
      pageNumber,
      image
    };

    // Call the callback with the new drawing
    onDrawingCreated(newLine);

    // Reset state
    cancelDrawing();
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
    
    if (!isMultiLineMode) {
      setIsMultiLineMode(true);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || drawingMode !== 'line' || !startPoint) return;

    // Get or reinitialize the canvas context
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || !canvasRef.current) return;

    // Get raw coordinates for the current mouse position
    const currentPoint = getRawCoordinates(e.clientX, e.clientY);
    setEndPoint(currentPoint);

    // Redraw all lines and current line
    redrawAllLines(ctx);
  };

  const endDrawing = () => {
    if (!isDrawing || drawingMode !== 'line' || !startPoint || !endPoint) {
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
    
    if (distance >= 5) { // Minimum line length of 5 pixels
      // Add the line to allLines
      setAllLines(prev => [...prev, { 
        startPoint: { ...startPoint }, 
        endPoint: { ...finalEndPoint } 
      }]);
    }
    
    // Reset for next line but stay in multi-line mode
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={styles.lineDrawingCanvas}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={endDrawing}
        onMouseLeave={endDrawing}
        data-testid='line-drawing-canvas'
      />
      {isMultiLineMode && (
        <div className={styles.finishButtonContainer}>
          <button 
            className={styles.finishButton}
            onClick={finishDrawing}>
            Finish
          </button>
        </div>
      )}
    </>
  );
}; 