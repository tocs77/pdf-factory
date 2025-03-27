import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { TextArea, Drawing } from '../../model/types/viewerSchema';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { renderTextArea } from '../../utils/drawingRenderers';
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
  const shadowRectRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textInputContainerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Use a ref to track current dimensions instead of state
  const currentResizeDimensionsRef = useRef<{ width: number; height: number } | null>(null);

  // Track final dimensions for the resize operation (for the finish drawing function)
  const [resizeDimensions, setResizeDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

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
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the rectangle
    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = drawingLineWidth;

    // Calculate the rectangle coordinates
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    ctx.beginPath();
    ctx.rect(left, top, width, height);
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

    // Use final dimensions from resize if available
    const finalStartPoint = startPoint;
    const finalEndPoint = endPoint;

    if (resizeDimensions) {
      // Apply resize dimensions to the end point
      finalEndPoint.x = finalStartPoint.x + resizeDimensions.width;
      finalEndPoint.y = finalStartPoint.y + resizeDimensions.height;
      setResizeDimensions(null);
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate the rectangle bounds for the image capture
    const left = Math.min(finalStartPoint.x, finalEndPoint.x);
    const top = Math.min(finalStartPoint.y, finalEndPoint.y);
    const rectWidth = Math.abs(finalEndPoint.x - finalStartPoint.x);
    const rectHeight = Math.abs(finalEndPoint.y - finalStartPoint.y);

    // Clear the canvas first to remove any rectangle outlines
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Create a temporary TextArea object for rendering
    const tempTextArea: TextArea = {
      type: 'textArea',
      pageNumber,
      startPoint: {
        x: left,
        y: top,
      },
      endPoint: {
        x: left + rectWidth,
        y: top + rectHeight,
      },
      text,
      style: {
        strokeColor: drawingColor,
        strokeWidth: drawingLineWidth,
      },
    };

    // Render the text area on the canvas
    renderTextArea(
      ctx,
      tempTextArea,
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio,
      1, // Use scale 1 for the rendering since we're directly on canvas coordinates
      0, // Use rotation 0 for rendering since we're directly on canvas coordinates
    );

    // Add padding to the bounding box
    const padding = 10;
    const boundingBox = {
      left: Math.max(0, left - padding),
      top: Math.max(0, top - padding),
      width: Math.min(canvas.width / window.devicePixelRatio - left + padding, rectWidth + padding * 2),
      height: Math.min(canvas.height / window.devicePixelRatio - top + padding, rectHeight + padding * 2),
    };

    // Capture the image with the drawing layer included
    const image = captureDrawingImage(
      pdfCanvasRef?.current || null,
      canvas,
      boundingBox,
      true, // Set to true to capture both PDF background and the drawing layer
    );

    // Normalize coordinates to scale 1 and 0 degrees rotation
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      {
        x: left,
        y: top,
      },
      canvas.width / window.devicePixelRatio,
      canvas.height / window.devicePixelRatio,
      scale,
      rotation,
    );

    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      {
        x: left + rectWidth,
        y: top + rectHeight,
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

  // Cancel drawing if user clicks outside the text input
  const handleOutsideClick = (e: MouseEvent) => {
    if (showTextInput && textInputContainerRef.current && !textInputContainerRef.current.contains(e.target as Node)) {
      // Skip if we're resizing
      if (isResizing) return;

      // Cancel the drawing
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
    }
  };

  // Add and remove event listener for outside clicks
  useEffect(() => {
    if (showTextInput) {
      // Add event listener when text input is shown
      document.addEventListener('mousedown', handleOutsideClick);
    } else {
      // Remove event listener when text input is hidden
      document.removeEventListener('mousedown', handleOutsideClick);
    }

    // Cleanup function
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showTextInput, isResizing]);

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    console.log('Resize start');

    if (!startPoint || !endPoint || !textInputContainerRef.current) return;

    // Set resize mode active
    setIsResizing(true);

    // Calculate the current rectangle dimensions
    const left = Math.min(startPoint.x, endPoint.x);
    const top = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    // Initialize the current dimensions ref
    currentResizeDimensionsRef.current = { width, height };

    // Show shadow rect
    if (shadowRectRef.current) {
      shadowRectRef.current.style.display = 'block';
      shadowRectRef.current.style.left = `${left}px`;
      shadowRectRef.current.style.top = `${top}px`;
      shadowRectRef.current.style.width = `${width}px`;
      shadowRectRef.current.style.height = `${height}px`;
      shadowRectRef.current.style.borderColor = drawingColor;
    }

    const handleResizeMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();

      if (!shadowRectRef.current || !startPoint) return;

      // Get mouse position relative to canvas
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const mouseX = moveEvent.clientX - rect.left;
      const mouseY = moveEvent.clientY - rect.top;

      // Calculate new width and height from the starting point
      const left = Math.min(startPoint.x, endPoint!.x);
      const top = Math.min(startPoint.y, endPoint!.y);
      const newWidth = Math.max(mouseX - left, 50);
      const newHeight = Math.max(mouseY - top, 50);

      // Update the shadow rectangle
      shadowRectRef.current.style.width = `${newWidth}px`;
      shadowRectRef.current.style.height = `${newHeight}px`;

      console.log('Resize move:', { width: newWidth, height: newHeight });

      // Update the current dimensions ref (for immediate access)
      currentResizeDimensionsRef.current = { width: newWidth, height: newHeight };

      // Also update state (for finish drawing function)
      setResizeDimensions({ width: newWidth, height: newHeight });
    };

    const handleResizeEnd = () => {
      console.log('Resize end');

      // Hide shadow rect
      if (shadowRectRef.current) {
        shadowRectRef.current.style.display = 'none';
      }

      // Exit resize mode
      setIsResizing(false);

      // Get the latest dimensions from the ref (not from state)
      const currentDimensions = currentResizeDimensionsRef.current;

      // Apply the new dimensions to the text input container
      if (textInputContainerRef.current && currentDimensions) {
        console.log('Applying dimensions:', currentDimensions);

        textInputContainerRef.current.style.width = `${currentDimensions.width}px`;
        textInputContainerRef.current.style.height = `${currentDimensions.height}px`;

        // Update the end point using the ref value (not state)
        if (startPoint) {
          const newEndPoint = {
            x: startPoint.x + currentDimensions.width,
            y: startPoint.y + currentDimensions.height,
          };
          setEndPoint(newEndPoint);

          // Force a redraw of the rectangle on the canvas
          setTimeout(() => {
            if (canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d');
              if (ctx) {
                ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

                // Draw the rectangle with new dimensions
                ctx.strokeStyle = drawingColor;
                ctx.lineWidth = drawingLineWidth;
                ctx.beginPath();
                ctx.rect(
                  Math.min(startPoint.x, newEndPoint.x),
                  Math.min(startPoint.y, newEndPoint.y),
                  Math.abs(newEndPoint.x - startPoint.x),
                  Math.abs(newEndPoint.y - startPoint.y),
                );
                ctx.stroke();
              }
            }
          }, 0);
        }
      }

      // Reset the ref
      currentResizeDimensionsRef.current = null;

      // Remove event listeners
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };

    // Add event listeners
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

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
