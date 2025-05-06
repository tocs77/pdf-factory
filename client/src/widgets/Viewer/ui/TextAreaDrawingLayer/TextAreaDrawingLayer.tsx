import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { TextArea, Drawing } from '../../model/types/Drawings';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { renderTextArea } from '../../utils/drawingRenderers';
import classes from './TextAreaDrawingLayer.module.scss';

interface TextAreaDrawingLayerProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>;
  draftMode?: boolean;
}

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const TextAreaDrawingLayer = (props: TextAreaDrawingLayerProps) => {
  const { pageNumber, onDrawingCreated, pdfCanvasRef, draftMode = false } = props;
  const { state } = useContext(ViewerContext);
  const { drawingColor, drawingLineWidth, scale, requestFinishDrawing, requestCancelDrawing } = state;
  const rotation = state.pageRotations[pageNumber] || 0;

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shadowRectRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textInputContainerRef = useRef<HTMLDivElement>(null);
  const currentResizeDimensionsRef = useRef<{ width: number; height: number } | null>(null);

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);

  // Text input state
  const [showTextInput, setShowTextInput] = useState(false);
  const [text, setText] = useState('');

  // Resize state
  const [resizeDimensions, setResizeDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Calculate rectangle dimensions from points
  const getRectangleFromPoints = (start: Point, end: Point): Rectangle => {
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    return { left, top, width, height };
  };

  // Setup canvas dimensions to match the PDF page
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
    }
  }, [pdfCanvasRef]);

  // Get coordinates relative to canvas
  const getCanvasCoordinates = (clientX: number, clientY: number): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };

    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  // Clear the canvas
  const clearCanvas = () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Draw rectangle on canvas
  const drawRectangle = () => {
    if (!canvasRef.current || !startPoint || !endPoint) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearCanvas();

    // Draw rectangle
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;

    const rect = getRectangleFromPoints(startPoint, endPoint);
    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.stroke();
  };

  // Handle starting a new drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only react to left mouse button

    const point = getCanvasCoordinates(e.clientX, e.clientY);
    setIsDrawing(true);
    setStartPoint(point);
    setEndPoint(point);
  };

  // Handle drawing update during mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint) return;

    const point = getCanvasCoordinates(e.clientX, e.clientY);
    setEndPoint(point);
    drawRectangle();
  };

  // Handle completing the initial drawing
  const handleMouseUp = () => {
    if (!isDrawing || !startPoint || !endPoint) return;
    setIsDrawing(false);

    // Check if rectangle is too small (just a click)
    const rect = getRectangleFromPoints(startPoint, endPoint);
    if (rect.width < 5 || rect.height < 5) {
      resetDrawingState();
      return;
    }

    setShowTextInput(true);
  };

  // Reset drawing state
  const resetDrawingState = () => {
    setStartPoint(null);
    setEndPoint(null);
    setShowTextInput(false);
    setText('');
    setResizeDimensions(null);
    clearCanvas();
  };

  // Handle text input change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  // Finish drawing and create the TextArea object
  const handleFinishDrawing = () => {
    if (!startPoint || !endPoint || !canvasRef.current) return;

    // Apply any resize dimensions
    const finalStartPoint = { ...startPoint };
    const finalEndPoint = { ...endPoint };

    if (resizeDimensions) {
      finalEndPoint.x = finalStartPoint.x + resizeDimensions.width;
      finalEndPoint.y = finalStartPoint.y + resizeDimensions.height;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate rectangle bounds
    const rect = getRectangleFromPoints(finalStartPoint, finalEndPoint);

    // Clear canvas to remove rectangle outlines
    clearCanvas();

    // Create temporary TextArea for rendering
    const tempTextArea: TextArea = {
      id: '',
      type: 'textArea',
      pageNumber,
      startPoint: {
        x: rect.left,
        y: rect.top,
      },
      endPoint: {
        x: rect.left + rect.width,
        y: rect.top + rect.height,
      },
      text,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth,
      },
      boundingBox: {
        left: rect.left,
        top: rect.top,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
      },
    };

    // Render the text area on canvas
    renderTextArea(
      ctx,
      tempTextArea,
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio,
      1, // Scale 1 since we're using canvas coordinates
      0, // Rotation 0 since we're using canvas coordinates
    );

    // Add padding to bounding box for image capture
    const padding = 10;
    const boundingBox = {
      left: Math.max(0, rect.left - padding),
      top: Math.max(0, rect.top - padding),
      width: Math.min(canvas.width / window.devicePixelRatio - rect.left + padding, rect.width + padding * 2),
      height: Math.min(canvas.height / window.devicePixelRatio - rect.top + padding, rect.height + padding * 2),
    };

    // Capture image
    let image;
    if (!draftMode) {
      image = captureDrawingImage(
        pdfCanvasRef?.current || null,
        canvas,
        boundingBox,
        true, // Capture both PDF background and drawing
      );
    }

    // Normalize coordinates to scale 1 and 0 degrees rotation
    const canvasWidth = canvas.width / window.devicePixelRatio;
    const canvasHeight = canvas.height / window.devicePixelRatio;

    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      { x: rect.left, y: rect.top },
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      { x: rect.left + rect.width, y: rect.top + rect.height },
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    // Create final drawing object
    const drawing: TextArea = {
      id: '',
      type: 'textArea',
      pageNumber,
      startPoint: normalizedStartPoint,
      endPoint: normalizedEndPoint,
      text,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth / scale, // Store at scale 1
      },
      boundingBox: {
        left: normalizedStartPoint.x,
        top: normalizedStartPoint.y,
        right: normalizedEndPoint.x,
        bottom: normalizedEndPoint.y,
      },
      image,
    };

    // Submit drawing and reset state
    onDrawingCreated(drawing);
    resetDrawingState();
  };

  // Focus textarea when it appears
  useEffect(() => {
    if (showTextInput && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showTextInput]);

  // Handle clicks outside text input (cancel drawing)
  const handleOutsideClick = (e: MouseEvent) => {
    const isOutsideClick =
      showTextInput && textInputContainerRef.current && !textInputContainerRef.current.contains(e.target as Node);

    if (isOutsideClick && !isResizing) {
      resetDrawingState();
    }
  };

  // Add/remove outside click listener
  useEffect(() => {
    if (showTextInput) {
      document.addEventListener('mousedown', handleOutsideClick);
    } else {
      document.removeEventListener('mousedown', handleOutsideClick);
    }

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showTextInput, isResizing]);

  // Start resizing operation
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!startPoint || !endPoint || !textInputContainerRef.current) return;

    setIsResizing(true);

    // Get current rectangle dimensions
    const rect = getRectangleFromPoints(startPoint, endPoint);
    currentResizeDimensionsRef.current = { width: rect.width, height: rect.height };

    // Show and position shadow rectangle
    if (shadowRectRef.current) {
      shadowRectRef.current.style.display = 'block';
      shadowRectRef.current.style.left = `${rect.left}px`;
      shadowRectRef.current.style.top = `${rect.top}px`;
      shadowRectRef.current.style.width = `${rect.width}px`;
      shadowRectRef.current.style.height = `${rect.height}px`;
      shadowRectRef.current.style.borderColor = drawingColor;
    }

    // Handler for resizing movement
    const handleResizeMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();

      if (!shadowRectRef.current || !startPoint) return;

      // Get mouse position
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = moveEvent.clientX - rect.left;
      const mouseY = moveEvent.clientY - rect.top;

      // Calculate dimensions from start point
      const left = Math.min(startPoint.x, endPoint!.x);
      const top = Math.min(startPoint.y, endPoint!.y);
      const newWidth = Math.max(mouseX - left, 50);
      const newHeight = Math.max(mouseY - top, 50);

      // Update shadow rectangle
      shadowRectRef.current.style.width = `${newWidth}px`;
      shadowRectRef.current.style.height = `${newHeight}px`;

      // Store dimensions for updates
      const newDimensions = { width: newWidth, height: newHeight };
      currentResizeDimensionsRef.current = newDimensions;
      setResizeDimensions(newDimensions);
    };

    // Handler for completing resize
    const handleResizeEnd = () => {
      // Hide shadow rectangle
      if (shadowRectRef.current) {
        shadowRectRef.current.style.display = 'none';
      }

      setIsResizing(false);

      // Get final dimensions from ref
      const finalDimensions = currentResizeDimensionsRef.current;
      if (!finalDimensions) return;

      // Apply dimensions to text input container
      if (textInputContainerRef.current) {
        textInputContainerRef.current.style.width = `${finalDimensions.width}px`;
        textInputContainerRef.current.style.height = `${finalDimensions.height}px`;

        // Update end point
        if (startPoint) {
          const newEndPoint = {
            x: startPoint.x + finalDimensions.width,
            y: startPoint.y + finalDimensions.height,
          };
          setEndPoint(newEndPoint);

          // Redraw rectangle on canvas
          setTimeout(() => {
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                clearCanvas();

                ctx.strokeStyle = drawingColor;
                ctx.lineWidth = drawingLineWidth;
                ctx.beginPath();

                const updatedRect = getRectangleFromPoints(startPoint, newEndPoint);
                ctx.rect(updatedRect.left, updatedRect.top, updatedRect.width, updatedRect.height);
                ctx.stroke();
              }
            }
          }, 0);
        }
      }

      currentResizeDimensionsRef.current = null;

      // Remove event listeners
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    // Add event listeners
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // Handle finish drawing request
  useEffect(() => {
    if (requestFinishDrawing && showTextInput) {
      handleFinishDrawing();
    }
  }, [requestFinishDrawing]);

  // Handle cancel drawing request
  useEffect(() => {
    if (requestCancelDrawing && (isDrawing || showTextInput)) {
      resetDrawingState();
    }
  }, [requestCancelDrawing]);

  return (
    <div className={classes.textAreaDrawingLayer}>
      <canvas
        ref={canvasRef}
        className={classes.drawingCanvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      {/* Shadow rectangle for resize operations */}
      <div
        ref={shadowRectRef}
        className={classes.shadowRect}
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
          border: `2px dashed ${drawingColor}`,
          boxSizing: 'border-box',
        }}
      />

      {showTextInput && startPoint && endPoint && (
        <div
          ref={textInputContainerRef}
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
          <div className={classes.resizeHandle} onMouseDown={handleResizeStart} />
        </div>
      )}
    </div>
  );
};

export default TextAreaDrawingLayer;
