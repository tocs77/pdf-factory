import React, { useEffect, useRef, useContext, useState, useCallback } from 'react';

import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { Drawing, ExtensionLine } from '../../model/types/Drawings';
import classes from './ExtensionLineDrawingComponent.module.scss';
import { renderExtensionLine } from '../../utils/renderers/renderExtensionLine';
import { calculateExtensionLineBoundingBox } from '../../utils/calculateExtensionLineBoundingBox';

interface ExtensionLineDrawingComponentProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the PDF canvas
  draftMode?: boolean;
}

export const ExtensionLineDrawingComponent = (props: ExtensionLineDrawingComponentProps) => {
  const { pageNumber, onDrawingCreated, pdfCanvasRef, draftMode = false } = props;
  const { state } = useContext(ViewerContext);
  const { scale, drawingColor, pageRotations, drawingMode } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const textInputContainerRef = useRef<HTMLDivElement>(null);

  // States for tracking the drawing process
  const [drawingStage, setDrawingStage] = useState<'initial' | 'textInput'>('initial');
  const [isDragging, setIsDragging] = useState(false);
  const [pinPointPosition, setPinPointPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<{ x: number; y: number } | null>(null);

  // Text input state
  const [showTextInput, setShowTextInput] = useState(false);
  const [text, setText] = useState('');
  const [pendingDrawingData, setPendingDrawingData] = useState<any>(null);

  // Set up drawing canvas
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
  }, []);

  // Reset drawing state when switching pages or drawing modes
  useEffect(() => {
    setPinPointPosition(null);
    setCurrentMousePosition(null);
    setDrawingStage('initial');
    setIsDragging(false);
    setShowTextInput(false);
    setText('');
  }, [pageNumber, drawingMode]);

  // Set cursor to crosshair
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;

    const handleMouseEnter = () => {
      // Force the cursor to be a crosshair
      canvas.style.cursor = 'crosshair';
    };

    canvas.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      canvas.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, []);

  // Draw the extension line and arrow preview
  useEffect(() => {
    if (!canvasRef.current || !pinPointPosition) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if ((isDragging || drawingStage === 'textInput') && currentMousePosition) {
      // If we're dragging or in textInput stage, draw a preview of the arrow
      const previewExtensionLine = {
        id: '',
        type: 'extensionLine' as const,
        position: pinPointPosition,
        bendPoint: currentMousePosition,
        text: drawingStage === 'textInput' ? text : '', // Show text if in textInput stage
        color: drawingColor,
        pageNumber,
        boundingBox: {
          left: pinPointPosition.x,
          top: pinPointPosition.y,
          right: currentMousePosition.x,
          bottom: currentMousePosition.y,
        },
      };

      // Draw the pin with the current mouse position as the bend point
      renderExtensionLine(ctx, previewExtensionLine, pinPointPosition.x, pinPointPosition.y);
    }
  }, [pinPointPosition, currentMousePosition, drawingStage, isDragging, drawingColor, pageNumber, text]);

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

  // Handle mouse movement
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;

    // Update current mouse position
    setCurrentMousePosition(getRawCoordinates(e.clientX, e.clientY));
  };

  // Handle text input change
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  // Finish drawing and create the ExtensionLine object
  const handleFinishDrawing = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!pendingDrawingData) return;

    const { normalizedPinPoint, normalizedBendPoint, canvas, currentCoords, pinPointPosition } = pendingDrawingData;

    // Create a temporary extension line object with current coordinates for bounding box calculation
    const tempExtensionLine = {
      position: pinPointPosition,
      bendPoint: currentCoords,
      text,
    };

    // Calculate the accurate bounding box including text
    const ctx = canvas.getContext('2d');
    const boundingBox = calculateExtensionLineBoundingBox(
      tempExtensionLine as ExtensionLine,
      canvas.width,
      canvas.height,
      ctx || undefined,
    );

    // Normalize the bounding box coordinates
    const boundPointTopLeft = normalizeCoordinatesToZeroRotation(
      { x: boundingBox.left, y: boundingBox.top },
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );
    const boundPointBottomRight = normalizeCoordinatesToZeroRotation(
      { x: boundingBox.left + boundingBox.width, y: boundingBox.top + boundingBox.height },
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    const normalizedBoundingBox = {
      left: boundPointTopLeft.x,
      top: boundPointTopLeft.y,
      right: boundPointBottomRight.x,
      bottom: boundPointBottomRight.y,
    };

    // Capture the image with the accurate bounding box
    let image;
    if (!draftMode) {
      image = captureDrawingImage(pdfCanvasRef?.current || null, canvas, boundingBox);
    }

    // Create a new extension line object with normalized coordinates
    const newExtensionLine: Drawing = {
      id: '',
      type: 'extensionLine',
      position: normalizedPinPoint,
      bendPoint: normalizedBendPoint,
      text,
      color: drawingColor,
      pageNumber,
      image,
      boundingBox: normalizedBoundingBox,
    };

    // Call the callback with the new drawing
    onDrawingCreated(newExtensionLine);

    // Reset drawing state
    resetDrawingState();
  };

  const resetDrawingState = useCallback(() => {
    setPinPointPosition(null);
    setCurrentMousePosition(null);
    setDrawingStage('initial');
    setIsDragging(false);
    setPendingDrawingData(null);
    setShowTextInput(false);
    setText('');

    // Clear the canvas since we're aborting the drawing
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, []);

  // Focus textarea when it appears
  useEffect(() => {
    if (showTextInput && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [showTextInput]);

  // Handle clicks outside text input (cancel drawing)
  const handleOutsideClick = useCallback(
    (e: MouseEvent) => {
      const isOutsideClick =
        showTextInput && textInputContainerRef.current && !textInputContainerRef.current.contains(e.target as Node);

      if (isOutsideClick) {
        resetDrawingState();
      }
    },
    [showTextInput, resetDrawingState],
  );

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
  }, [showTextInput, handleOutsideClick]);

  // Handle mouse down to start drawing
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only react to left mouse button
    if (drawingMode !== 'extensionLine') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Only start drawing if we're in the initial stage
    if (drawingStage !== 'initial') return;

    // Get click coordinates relative to canvas
    const coords = getRawCoordinates(e.clientX, e.clientY);

    // Set the pin point position and start dragging
    setPinPointPosition(coords);
    setCurrentMousePosition(coords);
    setIsDragging(true);
  };

  // Handle mouse up to finish positioning and show text input
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || drawingMode !== 'extensionLine') return;

    const canvas = canvasRef.current;
    if (!canvas || !pinPointPosition) return;

    // Get final coordinates
    const coords = getRawCoordinates(e.clientX, e.clientY);

    // Set the bend point position to current mouse position
    setCurrentMousePosition(coords);

    // Normalize the pin and bend points to scale 1 and 0 degrees rotation
    const normalizedPinPoint = normalizeCoordinatesToZeroRotation(pinPointPosition, canvas.width, canvas.height, scale, rotation);

    const normalizedBendPoint = normalizeCoordinatesToZeroRotation(coords, canvas.width, canvas.height, scale, rotation);

    // Store the drawing data temporarily (without bounding box and image)
    // These will be calculated in handleFinishDrawing with the final text
    setPendingDrawingData({
      normalizedPinPoint,
      normalizedBendPoint,
      canvas,
      currentCoords: coords,
      pinPointPosition,
    });

    // Stop dragging and show text input
    setIsDragging(false);
    setDrawingStage('textInput');
    setShowTextInput(true);
  };

  // Handle mouse leave to cancel drawing if dragging
  const handleMouseLeave = () => {
    if (isDragging) {
      resetDrawingState();
    }
  };

  // Handle keyboard events for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Escape key cancels current drawing
    if (e.key === 'Escape' && (isDragging || drawingStage === 'textInput')) {
      e.preventDefault();
      resetDrawingState();
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={classes.extensionLineCanvas}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        tabIndex={0} // Make canvas focusable
        data-testid='extensionLine-drawing-canvas'
      />

      {showTextInput && currentMousePosition && (
        <div
          ref={textInputContainerRef}
          className={classes.textInputContainer}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          style={{
            left: `${currentMousePosition.x + 10}px`, // Offset from arrow tail
            top: `${currentMousePosition.y - 60}px`, // Position above arrow tail
            width: '150px',
            height: '60px',
          }}>
          <textarea
            ref={textareaRef}
            className={classes.textInput}
            value={text}
            onChange={handleTextChange}
            placeholder='Введите текст выноски...'
            style={{
              color: drawingColor,
            }}
          />
          <button className={classes.finishButton} onClick={handleFinishDrawing}>
            Готово
          </button>
        </div>
      )}
    </>
  );
};
