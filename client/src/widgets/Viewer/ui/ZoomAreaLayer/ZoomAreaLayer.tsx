import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
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
  const getRawCoordinates = (clientX: number, clientY: number): { x: number, y: number } => {
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
    
    // Determine the center point of the selection in the canvas
    const centerX = left + selectionWidth / 2;
    const centerY = top + selectionHeight / 2;
    
    // Scroll to center the selection
    const pageElement = document.getElementById(`page-${pageNumber}`);
    if (pageElement) {
      const pageRect = pageElement.getBoundingClientRect();
      
      // Find the parent element that has scrolling capabilities (could be pdfContainerRef)
      let scrollParent = pageElement.parentElement;
      while (scrollParent && getComputedStyle(scrollParent).overflow !== 'auto' && getComputedStyle(scrollParent).overflow !== 'scroll') {
        scrollParent = scrollParent.parentElement;
      }
      
      if (scrollParent) {
        // Calculate where to scroll based on the center point of the selection
        const scrollX = centerX - scrollParent.clientWidth / 2;
        const scrollY = centerY - scrollParent.clientHeight / 2;
        
        // Update the scale first
        dispatch({ type: 'setScale', payload: newScale });
        
        // Then scroll to the center of the selection (after a small delay to allow re-render)
        setTimeout(() => {
          scrollParent?.scrollTo({
            left: scrollX,
            top: scrollY + pageRect.top + scrollParent.scrollTop - window.scrollY,
            behavior: 'smooth'
          });
        }, 100);
      }
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
      data-testid="zoom-area-canvas"
    />
  );
};

export default ZoomAreaLayer; 