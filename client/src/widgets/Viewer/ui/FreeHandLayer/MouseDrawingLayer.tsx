import React from 'react';
import { DrawingStyle } from '../../model/types/Drawings';
import classes from './FreeHandLayer.module.scss';

interface MouseDrawingLayerProps {
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

export const MouseDrawingLayer = (props: MouseDrawingLayerProps) => {
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

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only react to left mouse button

    // Initialize or reinitialize the canvas
    const ctx = initializeCanvas();
    if (!ctx) return;

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);
    onStartDrawing({ x, y });

    // Start drawing
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = currentStyle.strokeColor;
    ctx.lineWidth = currentStyle.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    // Get raw coordinates
    const { x, y } = getRawCoordinates(e.clientX, e.clientY);
    onDraw({ x, y });
  };

  const endDrawing = () => {
    if (!isDrawing || drawingMode !== 'freehand') {
      return;
    }

    onEndDrawing();
  };

  return (
    <canvas
      ref={canvasRef}
      className={classes.drawingCanvas}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={endDrawing}
      onMouseLeave={endDrawing}
      data-testid='freehand-drawing-canvas-mouse'
    />
  );
};
