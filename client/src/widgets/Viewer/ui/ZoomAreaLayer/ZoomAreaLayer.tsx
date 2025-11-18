import { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation, transformCoordinates } from '../../utils/rotationUtils';
import styles from './ZoomAreaLayer.module.scss';

interface ZoomAreaLayerProps {
  pageNumber: number;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

/**
 * Component for handling zoom area selection
 */
export const ZoomAreaLayer = (props: ZoomAreaLayerProps) => {
  const { pageNumber, pdfCanvasRef } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { drawingMode, scale, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);

  // Set up canvas and hide when not in zoomArea mode
  useEffect(() => {
    if (!canvasRef.current) return;

    if (drawingMode === 'zoomArea') {
      canvasRef.current.style.display = 'block';
    } else {
      canvasRef.current.style.display = 'none';
      // Reset state when switching out of zoom area mode
      setIsSelecting(false);
      setStartPoint(null);
      setEndPoint(null);
    }
  }, [drawingMode]);

  // Set up drawing canvas to match PDF canvas dimensions
  useEffect(() => {
    if (!canvasRef.current || !pdfCanvasRef?.current) return;

    const canvas = canvasRef.current;
    const pdfCanvas = pdfCanvasRef.current;

    // Match canvas size to PDF canvas
    canvas.width = pdfCanvas.width;
    canvas.height = pdfCanvas.height;

    // Scale context according to device pixel ratio
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const scaleFactor = pdfCanvas.width / pdfCanvas.clientWidth;
      ctx.scale(scaleFactor, scaleFactor);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [pdfCanvasRef]);

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
  const startSelection = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (drawingMode !== 'zoomArea') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);

    setIsSelecting(true);
    setStartPoint(point);
    setEndPoint(point);
  };

  const updateSelection = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !startPoint || drawingMode !== 'zoomArea') return;

    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);
    setEndPoint(point);

    // Draw selection rectangle
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw selection rectangle
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(33, 150, 243, 0.7)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const rectX = Math.min(startPoint.x, point.x);
    const rectY = Math.min(startPoint.y, point.y);
    const rectWidth = Math.abs(point.x - startPoint.x);
    const rectHeight = Math.abs(point.y - startPoint.y);

    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
    ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
    ctx.fillRect(rectX, rectY, rectWidth, rectHeight);
    ctx.setLineDash([]);
  };

  const endSelection = () => {
    if (!isSelecting || !startPoint || !endPoint || drawingMode !== 'zoomArea') {
      setIsSelecting(false);
      setStartPoint(null);
      setEndPoint(null);
      return;
    }

    const canvas = canvasRef.current;
    const pdfCanvas = pdfCanvasRef?.current;
    if (!canvas || !pdfCanvas) {
      return;
    }

    // Check if the selection is too small (just a click)
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    if (width < 10 || height < 10) {
      setIsSelecting(false);
      setStartPoint(null);
      setEndPoint(null);

      // Clear the canvas
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    // Calculate the selection bounds
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const selectionWidth = Math.abs(endPoint.x - startPoint.x);
    const selectionHeight = Math.abs(endPoint.y - startPoint.y);

    // Calculate the selection center
    const selectionCenterX = left + selectionWidth / 2;
    const selectionCenterY = top + selectionHeight / 2;

    // Calculate the new scale based on the selection and viewport size
    const parentElement = pdfCanvas.parentElement;
    if (!parentElement) return;

    const viewportWidth = parentElement.clientWidth;
    const viewportHeight = parentElement.clientHeight;

    // Calculate the scale necessary to fit the selection to the viewport
    const scaleX = viewportWidth / selectionWidth;
    const scaleY = viewportHeight / selectionHeight;

    // Use the smaller scale to ensure the entire selection is visible
    const newScale = Math.min(scaleX, scaleY) * scale;

    // Normalize selection center coordinates to scale 1 and 0 degrees rotation
    const normalizedCenter = normalizeCoordinatesToZeroRotation(
      { x: selectionCenterX, y: selectionCenterY },
      pdfCanvas.clientWidth,
      pdfCanvas.clientHeight,
      scale,
      rotation,
    );

    // Find the scrollable container
    let scrollContainer: HTMLElement | null = parentElement;
    while (
      scrollContainer &&
      getComputedStyle(scrollContainer).overflow !== 'auto' &&
      getComputedStyle(scrollContainer).overflow !== 'scroll'
    ) {
      scrollContainer = scrollContainer.parentElement;
    }

    // Update the scale first
    dispatch({ type: 'setScale', payload: newScale });

    // After scale change, recalculate the coordinates and scroll
    setTimeout(() => {
      if (!scrollContainer || !pdfCanvasRef?.current) return;

      const updatedPdfCanvas = pdfCanvasRef.current;

      // Transform the normalized center back to current scale and rotation
      const transformedCenter = transformCoordinates(
        normalizedCenter.x,
        normalizedCenter.y,
        updatedPdfCanvas.clientWidth,
        updatedPdfCanvas.clientHeight,
        newScale,
        rotation,
      );

      // Get the canvas position on screen
      const canvasRect = updatedPdfCanvas.getBoundingClientRect();
      const canvasScreenX = canvasRect.left;
      const canvasScreenY = canvasRect.top;

      // Calculate the absolute position of the center point on screen
      const centerScreenX = canvasScreenX + transformedCenter.x;
      const centerScreenY = canvasScreenY + transformedCenter.y;

      // Get the container's current dimensions and position
      const containerRect = scrollContainer.getBoundingClientRect();

      // Calculate the scroll positions to center the selected area in the viewport
      const scrollLeft = scrollContainer.scrollLeft + (centerScreenX - containerRect.left) - containerRect.width / 2;
      const scrollTop = scrollContainer.scrollTop + (centerScreenY - containerRect.top) - containerRect.height / 2;

      // Smooth scroll to center the drawing in both directions
      scrollContainer.scrollTo({
        left: scrollLeft,
        top: scrollTop,
        behavior: 'smooth',
      });
    }, 100);

    // Reset state and turn off zoomArea mode
    setIsSelecting(false);
    setStartPoint(null);
    setEndPoint(null);
    dispatch({ type: 'setDrawingMode', payload: 'none' });

    // Clear the canvas
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <canvas
      ref={canvasRef}
      className={styles.zoomAreaCanvas}
      onMouseDown={startSelection}
      onMouseMove={updateSelection}
      onMouseUp={endSelection}
      onMouseLeave={endSelection}
      data-testid='zoom-area-canvas'
    />
  );
};

export default ZoomAreaLayer;
