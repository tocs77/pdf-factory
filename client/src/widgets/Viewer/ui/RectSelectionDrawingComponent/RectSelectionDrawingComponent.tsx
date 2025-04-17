import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { RectSelection } from '../../model/types/viewerSchema';
import styles from './RectSelectionDrawingComponent.module.scss';

interface RectSelectionDrawingComponentProps {
  pageNumber: number;
  onDrawingCreated: (drawing: RectSelection) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the PDF canvas
}

const CAPTURE_PADDING = 10; // Padding around the selection for image capture

const RectSelectionDrawingComponent = (props: RectSelectionDrawingComponentProps) => {
  const { pageNumber, onDrawingCreated, pdfCanvasRef } = props;
  const { state } = useContext(ViewerContext);
  const { scale, drawingMode, pageRotations, drawingColor, drawingLineWidth } = state;

  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);

  // Set up drawing canvas dimensions and clear it
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    } else {
      console.warn('No parent element found for canvas');
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [scale, pageNumber, rotation]); // Re-run if scale, page, or rotation changes

  // Ensure cursor is always crosshair when the component is active
  useEffect(() => {
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'crosshair';
    }
  }, []);

  const getRawCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return { x, y };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || drawingMode !== 'rectSelection') return; // Only left button and correct mode
    const point = getRawCoordinates(e.clientX, e.clientY);
    setIsDrawing(true);
    setStartPoint(point);
    setEndPoint(point);
  };

  const drawSelectionRectangle = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || drawingMode !== 'rectSelection') return;

    const point = getRawCoordinates(e.clientX, e.clientY);
    setEndPoint(point);

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear previous frame

    // Draw dashed rectangle
    ctx.beginPath();
    ctx.strokeStyle = '#0000FF'; // Blue color for selection rect
    ctx.lineWidth = 1; // Thin line
    ctx.setLineDash([4, 4]); // Dashed style
    ctx.rect(startPoint.x, startPoint.y, point.x - startPoint.x, point.y - startPoint.y);
    ctx.stroke();
    ctx.setLineDash([]); // Reset line dash
  };

  const endDrawing = () => {
    if (!isDrawing || drawingMode !== 'rectSelection' || !startPoint || !endPoint) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      // Clear any partial drawing if mouse leaves canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || !pdfCanvasRef?.current) {
      setIsDrawing(false); // Reset state even if capture fails
      setStartPoint(null);
      setEndPoint(null);
      return;
    }

    // Prevent creating tiny selections (likely accidental clicks)
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);
    if (width < 5 || height < 5) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Calculate bounding box for image capture (with padding)
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const rectWidth = Math.abs(endPoint.x - startPoint.x);
    const rectHeight = Math.abs(endPoint.y - startPoint.y);

    const boundingBoxForCapture = {
      left: Math.max(0, left - CAPTURE_PADDING),
      top: Math.max(0, top - CAPTURE_PADDING),
      width: Math.min(canvas.width - (left - CAPTURE_PADDING), rectWidth + CAPTURE_PADDING * 2),
      height: Math.min(canvas.height - (top - CAPTURE_PADDING), rectHeight + CAPTURE_PADDING * 2),
    };

    // IMPORTANT: Capture image from the PDF canvas *before* clearing the selection rectangle
    // We pass null for the drawingCanvasRef and false for captureDrawingLayer
    // to captureDrawingImage because we don't want the temporary selection rectangle included.
    const capturedImage = captureDrawingImage(
      pdfCanvasRef.current,
      null, // No drawing canvas overlay needed
      boundingBoxForCapture,
      false, // Explicitly set captureDrawingLayer to false
    );

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

    // Create the new rectSelection object
    const newSelection: RectSelection = {
      id: '',
      type: 'rectSelection',
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      pageNumber,
      image: capturedImage,
      boundingBox: {
        left: normalizedStartPoint.x,
        top: normalizedStartPoint.y,
        right: normalizedEndPoint.x,
        bottom: normalizedEndPoint.y,
      },
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth / scale, // Use context.drawingLineWidth for the final rectangle
      },
    };

    // Call the callback
    onDrawingCreated(newSelection);

    // Reset drawing state and clear the interaction canvas
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Optionally, switch back to 'none' mode after selection
    // dispatch({ type: 'setDrawingMode', payload: 'none' });
  };

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingCanvas}
      onMouseDown={startDrawing}
      onMouseMove={drawSelectionRectangle}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing} // End drawing if mouse leaves canvas
      data-testid='rect-selection-canvas'
      style={{ zIndex: 20 }} // Ensure it's above other drawing layers but potentially below UI elements
    />
  );
};

export default RectSelectionDrawingComponent;
