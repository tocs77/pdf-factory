import React, { useEffect } from 'react';
import { DrawingStyle } from '../../model/types/Drawings';
import classes from './FreeHandLayer.module.scss';

interface TouchDrawingLayerProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  isDrawing: boolean;
  currentStyle: DrawingStyle;
  drawingMode: string;
  onStartDrawing: (coordinates: { x: number; y: number }) => void;
  onDraw: (coordinates: { x: number; y: number }) => void;
  onEndDrawing: () => void;
  getRawCoordinates: (clientX: number, clientY: number) => { x: number; y: number };
  initializeCanvas: () => CanvasRenderingContext2D | null;
}

export const TouchDrawingLayer = (props: TouchDrawingLayerProps) => {
  const {
    canvasRef,
    isDrawing,
    currentStyle,
    drawingMode,
    onStartDrawing,
    onDraw,
    onEndDrawing,
    getRawCoordinates,
    initializeCanvas,
  } = props;

  // Use native touch event listeners to allow preventDefault
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startTouchDrawing = (e: TouchEvent) => {
      if (e.touches.length !== 1) return; // Only handle single touch

      // Prevent default touch behavior to avoid scrolling
      e.preventDefault();

      // Initialize or reinitialize the canvas
      const ctx = initializeCanvas();
      if (!ctx) return;

      const touch = e.touches[0];
      // Get raw coordinates
      const { x, y } = getRawCoordinates(touch.clientX, touch.clientY);
      onStartDrawing({ x, y });

      // Start drawing
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = currentStyle.strokeColor;
      ctx.lineWidth = currentStyle.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    };

    const drawTouch = (e: TouchEvent) => {
      if (!isDrawing || e.touches.length !== 1) return;

      e.preventDefault();

      const touch = e.touches[0];
      // Get raw coordinates
      const { x, y } = getRawCoordinates(touch.clientX, touch.clientY);
      onDraw({ x, y });
    };

    const endTouchDrawing = (e: TouchEvent) => {
      e.preventDefault();

      if (!isDrawing || drawingMode !== 'freehand') {
        return;
      }

      onEndDrawing();
    };

    // Add native event listeners with passive: false
    canvas.addEventListener('touchstart', startTouchDrawing, { passive: false });
    canvas.addEventListener('touchmove', drawTouch, { passive: false });
    canvas.addEventListener('touchend', endTouchDrawing, { passive: false });
    canvas.addEventListener('touchcancel', endTouchDrawing, { passive: false });

    return () => {
      canvas.removeEventListener('touchstart', startTouchDrawing);
      canvas.removeEventListener('touchmove', drawTouch);
      canvas.removeEventListener('touchend', endTouchDrawing);
      canvas.removeEventListener('touchcancel', endTouchDrawing);
    };
  }, [
    canvasRef,
    isDrawing,
    currentStyle,
    drawingMode,
    onStartDrawing,
    onDraw,
    onEndDrawing,
    getRawCoordinates,
    initializeCanvas,
  ]);

  return <canvas ref={canvasRef} className={classes.drawingCanvas} data-testid='freehand-drawing-canvas-touch' />;
};
