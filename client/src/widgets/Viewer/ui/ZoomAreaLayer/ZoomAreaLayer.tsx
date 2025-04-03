import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation, transformCoordinates } from '../../utils/rotationUtils';
import styles from './ZoomAreaLayer.module.scss';

interface ZoomAreaLayerProps {
  pageNumber: number;
}

/**
 * Component for handling zoom area selection
 */
export const ZoomAreaLayer: React.FC<ZoomAreaLayerProps> = ({ pageNumber }) => {
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

  // Set up drawing canvas whenever rotation, scale, or page changes
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
    if (!canvas) {
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

    // Calculate the new scale based on the selection and parent element size
    const parentElement = canvas.parentElement;
    if (!parentElement) return;

    const parentWidth = parentElement.clientWidth;
    const parentHeight = parentElement.clientHeight;

    // Calculate the scale necessary to fit the selection to the viewport
    const scaleX = parentWidth / selectionWidth;
    const scaleY = parentHeight / selectionHeight;

    // Use the smaller scale to ensure the entire selection is visible
    const newScale = Math.min(scaleX, scaleY) * scale;

    // Find the scrollable container
    let scrollContainer: HTMLElement | null = parentElement;
    while (
      scrollContainer &&
      getComputedStyle(scrollContainer).overflow !== 'auto' &&
      getComputedStyle(scrollContainer).overflow !== 'scroll'
    ) {
      scrollContainer = scrollContainer.parentElement;
    }

    if (scrollContainer) {
      // Normalize coordinates to scale 1 and 0 degrees rotation
      const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
        { x: left, y: top },
        canvas.width,
        canvas.height,
        scale,
        rotation,
      );

      const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
        { x: left + selectionWidth, y: top + selectionHeight },
        canvas.width,
        canvas.height,
        scale,
        rotation,
      );

      // Update the scale first
      dispatch({ type: 'setScale', payload: newScale });

      // After scale change, recalculate the coordinates
      setTimeout(() => {
        // Transform coordinates back to current scale and rotation
        const transformedStartPoint = transformCoordinates(
          normalizedStartPoint.x,
          normalizedStartPoint.y,
          canvas.width,
          canvas.height,
          newScale,
          rotation,
        );

        const transformedEndPoint = transformCoordinates(
          normalizedEndPoint.x,
          normalizedEndPoint.y,
          canvas.width,
          canvas.height,
          newScale,
          rotation,
        );

        // Calculate drawing dimensions and center point
        const drawingWidth = transformedEndPoint.x - transformedStartPoint.x;
        const drawingHeight = transformedEndPoint.y - transformedStartPoint.y;
        const drawingCenterX = transformedStartPoint.x + drawingWidth / 2;
        const drawingCenterY = transformedStartPoint.y + drawingHeight / 2;

        // Get the container's current dimensions
        const containerRect = scrollContainer?.getBoundingClientRect();
        if (!containerRect || !scrollContainer) return;

        // Calculate the scroll positions to center the drawing in the viewport
        // First get the current scroll position
        const currentScrollLeft = scrollContainer.scrollLeft;
        const currentScrollTop = scrollContainer.scrollTop;

        // Calculate the target scroll position to center the selection
        const targetScrollLeft = currentScrollLeft + (drawingCenterX - containerRect.left) - containerRect.width / 2;
        const targetScrollTop = currentScrollTop + (drawingCenterY - containerRect.top) - containerRect.height / 2;

        // Ensure the selection is fully visible by adjusting the scroll position
        const minScrollLeft = currentScrollLeft + (transformedStartPoint.x - containerRect.left);
        const maxScrollLeft = currentScrollLeft + (transformedEndPoint.x - containerRect.left) - containerRect.width;
        const minScrollTop = currentScrollTop + (transformedStartPoint.y - containerRect.top);
        const maxScrollTop = currentScrollTop + (transformedEndPoint.y - containerRect.top) - containerRect.height;

        // Use the target scroll position, but ensure the selection is fully visible
        const finalScrollLeft = Math.min(Math.max(targetScrollLeft, minScrollLeft), maxScrollLeft);
        const finalScrollTop = Math.min(Math.max(targetScrollTop, minScrollTop), maxScrollTop);

        // Smooth scroll to center the drawing in both directions
        scrollContainer.scrollTo({
          left: finalScrollLeft,
          top: finalScrollTop,
          behavior: 'smooth',
        });
      }, 100);
    }

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
