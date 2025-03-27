import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { TextArea, Drawing } from '../../model/types/viewerSchema';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import classes from './TextAreaDrawingLayer.module.scss';

interface TextAreaDrawingLayerProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

export const TextAreaDrawingLayer: React.FC<TextAreaDrawingLayerProps> = ({ pageNumber, onDrawingCreated, pdfCanvasRef }) => {
  const { state } = useContext(ViewerContext);
  const { drawingColor, drawingLineWidth, scale } = state;
  const { pageRotations } = state;
  const rotation = pageRotations[pageNumber] || 0;

  const drawingLayerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Setup canvas dimensions to match the PDF page
  useEffect(() => {
    if (!canvasRef.current || !pdfCanvasRef?.current) return;

    const canvas = canvasRef.current;
    const pdfCanvas = pdfCanvasRef.current;

    // Match the canvas size to the PDF canvas
    canvas.width = pdfCanvas.width;
    canvas.height = pdfCanvas.height;

    // Scale the context according to device pixel ratio
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Use the same scale factor as the PDF canvas
      const scaleFactor = pdfCanvas.width / pdfCanvas.clientWidth;
      ctx.scale(scaleFactor, scaleFactor);
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

  // Handle mouse down to start drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);

    setIsDrawing(true);
    setStartPoint(point);
    setEndPoint(point);
  };

  // Handle mouse move to update the rectangle
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !canvasRef.current) return;

    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);
    setEndPoint(point);

    // Draw the rectangle
    drawRectangle();
  };

  // Draw the rectangle on the canvas
  const drawRectangle = () => {
    if (!canvasRef.current || !startPoint || !endPoint) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width / window.devicePixelRatio, canvas.height / window.devicePixelRatio);

    // Draw the rectangle
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;

    ctx.beginPath();
    ctx.rect(startPoint.x, startPoint.y, endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    ctx.stroke();
  };

  // Handle mouse up to finish drawing
  const handleMouseUp = () => {
    if (!isDrawing || !startPoint || !endPoint) return;

    // Check if the rectangle is too small (just a click)
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    if (width < 5 || height < 5) {
      setIsDrawing(false);
      setStartPoint(null);
      setEndPoint(null);

      // Clear the canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      return;
    }

    setIsDrawing(false);
    setShowTextInput(true);
  };

  // Handle text input change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  // Finish drawing and create the TextArea drawing
  const handleFinishDrawing = () => {
    if (!startPoint || !endPoint || !canvasRef.current) return;

    const canvas = canvasRef.current;

    // Calculate the rectangle bounds for the image capture
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const rectWidth = Math.abs(endPoint.x - startPoint.x);
    const rectHeight = Math.abs(endPoint.y - startPoint.y);

    // Add padding to the bounding box
    const padding = 10;
    const boundingBox = {
      left: Math.max(0, left - padding),
      top: Math.max(0, top - padding),
      width: Math.min(canvas.width / window.devicePixelRatio - left + padding, rectWidth + padding * 2),
      height: Math.min(canvas.height / window.devicePixelRatio - top + padding, rectHeight + padding * 2),
    };

    // Capture the image - only the PDF background, without the drawing layer
    const image = captureDrawingImage(
      pdfCanvasRef?.current || null,
      canvas,
      boundingBox,
      false, // Set to false to only capture the PDF background
    );

    // Normalize coordinates to scale 1 and 0 degrees rotation
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      {
        x: Math.min(startPoint.x, endPoint.x),
        y: Math.min(startPoint.y, endPoint.y),
      },
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio,
      scale,
      rotation,
    );

    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      {
        x: Math.max(startPoint.x, endPoint.x),
        y: Math.max(startPoint.y, endPoint.y),
      },
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio,
      scale,
      rotation,
    );

    // Create the drawing object
    const drawing: TextArea = {
      type: 'textArea',
      pageNumber,
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      text,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth / scale, // Store line width at scale 1
      },
      image,
    };

    // Pass the drawing to the parent component
    onDrawingCreated(drawing);

    // Reset the component state
    setStartPoint(null);
    setEndPoint(null);
    setShowTextInput(false);
    setText('');

    // Clear the canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    }
  };

  // Focus the textarea when it appears
  useEffect(() => {
    if (showTextInput && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showTextInput]);

  return (
    <div ref={drawingLayerRef} className={classes.textAreaDrawingLayer}>
      <canvas
        ref={canvasRef}
        className={classes.drawingCanvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {showTextInput && startPoint && endPoint && (
        <div
          className={classes.textInputContainer}
          style={{
            left: `${Math.min(startPoint.x, endPoint.x)}px`,
            top: `${Math.min(startPoint.y, endPoint.y)}px`,
            width: `${Math.abs(endPoint.x - startPoint.x)}px`,
            height: `${Math.abs(endPoint.y - startPoint.y)}px`,
          }}>
          <textarea
            ref={textareaRef}
            className={classes.textInput}
            value={text}
            onChange={handleTextChange}
            placeholder='Enter text here...'
          />
          <button className={classes.finishButton} onClick={handleFinishDrawing}>
            Finish
          </button>
        </div>
      )}
    </div>
  );
};

export default TextAreaDrawingLayer;
