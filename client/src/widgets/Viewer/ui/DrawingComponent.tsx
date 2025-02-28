import { useRef, useEffect, useState } from 'react';
import styles from './DrawingComponent.module.scss';

interface DrawingComponentProps {
  scale: number;
  drawingColor: string;
  drawingLineWidth: number;
  textLayerEnabled: boolean;
}

const DrawingComponent = ({ scale, drawingColor, drawingLineWidth, textLayerEnabled }: DrawingComponentProps) => {
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastPositionRef = useRef({ x: 0, y: 0 });
  const drawingPathsRef = useRef<Array<{
    points: Array<{ x: number, y: number }>,
    color: string,
    lineWidth: number
  }>>([]);
  const currentPathRef = useRef<{
    points: Array<{ x: number, y: number }>,
    color: string,
    lineWidth: number
  } | null>(null);

  useEffect(() => {
    if (!drawingCanvasRef.current || textLayerEnabled) return;

    const drawingCanvas = drawingCanvasRef.current;
    const ctx = drawingCanvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    drawingCanvas.width = drawingCanvas.offsetWidth;
    drawingCanvas.height = drawingCanvas.offsetHeight;

    console.log('Canvas dimensions:', drawingCanvas.width, drawingCanvas.height);

    const startDrawing = (e: MouseEvent) => {
      const rect = drawingCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setIsDrawing(true);
      lastPositionRef.current = { x, y };

      currentPathRef.current = {
        points: [{ x, y }],
        color: drawingColor,
        lineWidth: drawingLineWidth
      };

      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = drawingLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(x, y);
    };

    const draw = (e: MouseEvent) => {
      if (!isDrawing || !currentPathRef.current) return;

      const rect = drawingCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      currentPathRef.current.points.push({ x, y });

      ctx.strokeStyle = drawingColor;
      ctx.lineWidth = drawingLineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(lastPositionRef.current.x, lastPositionRef.current.y);
      ctx.lineTo(x, y);
      ctx.stroke();

      lastPositionRef.current = { x, y };
    };

    const stopDrawing = (e: MouseEvent) => {
      if (isDrawing && currentPathRef.current) {
        const rect = drawingCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const lastPoint = currentPathRef.current.points[currentPathRef.current.points.length - 1];
        if (lastPoint.x !== x || lastPoint.y !== y) {
          currentPathRef.current.points.push({ x, y });

          ctx.beginPath();
          ctx.moveTo(lastPositionRef.current.x, lastPositionRef.current.y);
          ctx.lineTo(x, y);
          ctx.stroke();
        }

        drawingPathsRef.current.push(currentPathRef.current);
        currentPathRef.current = null;
      }

      setIsDrawing(false);
    };

    drawingCanvas.addEventListener('mousedown', startDrawing);
    drawingCanvas.addEventListener('mousemove', draw);
    drawingCanvas.addEventListener('mouseup', stopDrawing);
    drawingCanvas.addEventListener('mouseleave', stopDrawing);

    return () => {
      drawingCanvas.removeEventListener('mousedown', startDrawing);
      drawingCanvas.removeEventListener('mousemove', draw);
      drawingCanvas.removeEventListener('mouseup', stopDrawing);
      drawingCanvas.removeEventListener('mouseleave', stopDrawing);
    };
  }, [scale, drawingColor, drawingLineWidth, textLayerEnabled, isDrawing]);

  return (
    <canvas
      className={styles.drawingLayer}
      ref={drawingCanvasRef}
    />
  );
};

export default DrawingComponent; 