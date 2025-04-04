import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { Drawing } from '../../model/types/viewerSchema';
import styles from './DrawRect.module.scss';

interface DrawRectProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the PDF canvas
  draftMode?: boolean;
}

/**
 * Component for handling rectangle drawing
 */
const DrawRect: React.FC<DrawRectProps> = ({ pageNumber, onDrawingCreated, pdfCanvasRef, draftMode = false }) => {
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, drawingLineWidth, drawingMode, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);

  // Constant for capture distance around rectangle
  const CAPTURE_PADDING = 10;

  // Set up drawing canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (parent) {
      // Use parent dimensions directly without any transforms
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    } else {
      console.warn('No parent element found for canvas');
    }

    // Clear canvas
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get canvas context');
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, [scale, pageNumber, rotation]);

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
    if (e.button !== 0) return; // Only react to left mouse button

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);

    setIsDrawing(true);
    setStartPoint(point);
    setEndPoint(point);
  };

  const drawRectangle = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);
    setEndPoint(point);

    // Draw rectangle
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw rectangle
    ctx.beginPath();
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;
    ctx.rect(startPoint.x, startPoint.y, point.x - startPoint.x, point.y - startPoint.y);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (!isDrawing || drawingMode !== 'rectangle' || !startPoint || !endPoint) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Check if the rectangle is too small (just a click)
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    if (width < 5 || height < 5) {
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

    // Calculate the rectangle bounds
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const rectWidth = Math.abs(endPoint.x - startPoint.x);
    const rectHeight = Math.abs(endPoint.y - startPoint.y);

    // Add 10px padding around the rectangle for capture
    const boundingBox = {
      left: Math.max(0, left - CAPTURE_PADDING),
      top: Math.max(0, top - CAPTURE_PADDING),
      width: Math.min(canvas.width - left + CAPTURE_PADDING, rectWidth + CAPTURE_PADDING * 2),
      height: Math.min(canvas.height - top + CAPTURE_PADDING, rectHeight + CAPTURE_PADDING * 2),
    };

    // Capture the image with the rectangle drawn on it only if not in draft mode
    let image;
    if (!draftMode) {
      image = captureDrawingImage(pdfCanvasRef?.current || null, canvas, boundingBox);
    }

    // Normalize coordinates to scale 1 and 0 degrees rotation
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      {
        x: Math.min(startPoint.x, endPoint.x),
        y: Math.min(startPoint.y, endPoint.y),
      },
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      {
        x: Math.max(startPoint.x, endPoint.x),
        y: Math.max(startPoint.y, endPoint.y),
      },
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    // Create a new rectangle object with normalized coordinates
    const newRectangle: Drawing = {
      type: 'rectangle',
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth / scale, // Store line width at scale 1
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
    onDrawingCreated(newRectangle);

    // Reset state
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);

    // Clear the canvas since the rectangle will be rendered by the CompleteDrawings component
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
      onMouseMove={drawRectangle}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      data-testid='rect-drawing-canvas'
    />
  );
};
export default DrawRect;
