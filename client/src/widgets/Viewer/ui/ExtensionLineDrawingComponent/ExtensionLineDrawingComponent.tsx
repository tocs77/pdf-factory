import React, { useEffect, useRef, useContext, useState } from 'react';

import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { Drawing } from '../../model/types/viewerSchema';
import classes from './ExtensionLineDrawingComponent.module.scss';
import { renderExtensionLine } from '../../utils/extensionLineRenderer';

interface TextInputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (text: string) => void;
}

const TextInputDialog: React.FC<TextInputDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
    // Reset input value when dialog opens
    if (isOpen) {
      setInputValue('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(inputValue);
  };

  if (!isOpen) return null;

  return (
    <div className={classes.dialogOverlay}>
      <div className={classes.dialogContent}>
        <div className={classes.dialogHeader}>
          <h3>Добавление выноски</h3>
          <button onClick={onClose} className={classes.closeButton}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={classes.dialogBody}>
            <label htmlFor='extensionLineText' className={classes.textLabel}>
              Текст полки выноски
            </label>
            <input
              id='extensionLineText'
              ref={inputRef}
              type='text'
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder='Введите текст'
              className={classes.textInput}
            />
          </div>
          <div className={classes.dialogFooter}>
            <button type='button' onClick={onClose} className={classes.cancelButton}>
              Отмена
            </button>
            <button type='submit' className={classes.submitButton}>
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

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

  // States for tracking the multi-stage drawing process
  const [drawingStage, setDrawingStage] = useState<'initial' | 'positioning' | 'completed'>('initial');
  const [pinPointPosition, setPinPointPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<{ x: number; y: number } | null>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
  }, [scale, pageNumber, rotation]);

  // Reset drawing state when switching pages or drawing modes
  useEffect(() => {
    setPinPointPosition(null);
    setCurrentMousePosition(null);
    setDrawingStage('initial');
    setIsDialogOpen(false);
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

    if (drawingStage === 'positioning' && currentMousePosition) {
      // If we're in the positioning stage, draw a preview of the arrow
      const previewExtensionLine = {
        id: '',
        type: 'extensionLine' as const,
        position: pinPointPosition,
        bendPoint: currentMousePosition,
        text: '',
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
  }, [pinPointPosition, currentMousePosition, drawingStage, drawingColor, pageNumber]);

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
    if (drawingStage !== 'positioning') return;

    // Update current mouse position
    setCurrentMousePosition(getRawCoordinates(e.clientX, e.clientY));
  };

  const finalizeDrawing = (text: string) => {
    if (!pendingDrawingData) return;

    const { normalizedPinPoint, normalizedBendPoint, normalizedBoundingBox, image } = pendingDrawingData;

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
    setPinPointPosition(null);
    setCurrentMousePosition(null);
    setDrawingStage('initial');
    setPendingDrawingData(null);

    // Clear the canvas as the extension line will be rendered by CompleteDrawings
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleDialogSubmit = (text: string) => {
    setIsDialogOpen(false);
    if (text.trim()) {
      finalizeDrawing(text);
    } else {
      // Reset if user submits empty text
      resetDrawingState();
    }
  };

  const resetDrawingState = () => {
    setPinPointPosition(null);
    setCurrentMousePosition(null);
    setDrawingStage('initial');
    setPendingDrawingData(null);

    // Clear the canvas since we're aborting the drawing
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    resetDrawingState(); // Reset the drawing state which clears the canvas
  };

  // Handle clicks for pin placement
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only process clicks when in extension line drawing mode
    if (drawingMode !== 'extensionLine') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Get click coordinates relative to canvas
    const coords = getRawCoordinates(e.clientX, e.clientY);

    // If this is the first click, set the pin point position
    if (drawingStage === 'initial') {
      setPinPointPosition(coords);
      setDrawingStage('positioning');
    }
    // If this is the second click, save the bend point position and create extension line
    else if (drawingStage === 'positioning' && pinPointPosition) {
      // Set the bend point position to current mouse position
      setCurrentMousePosition(coords);

      // Normalize the pin and bend points to scale 1 and 0 degrees rotation
      const normalizedPinPoint = normalizeCoordinatesToZeroRotation(
        pinPointPosition,
        canvas.width,
        canvas.height,
        scale,
        rotation,
      );

      const normalizedBendPoint = normalizeCoordinatesToZeroRotation(coords, canvas.width, canvas.height, scale, rotation);

      // Calculate the bounding box for image capture
      // Expand the area around the extension line
      const padding = 50; // Extension lines need more padding for the arrow
      const boundingBox = {
        left: Math.max(0, Math.min(pinPointPosition.x, coords.x) - padding),
        top: Math.max(0, Math.min(pinPointPosition.y, coords.y) - padding),
        width: Math.min(canvas.width, Math.abs(coords.x - pinPointPosition.x) + padding * 2),
        height: Math.min(canvas.height, Math.abs(coords.y - pinPointPosition.y) + padding * 2),
      };

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

      // Capture the image only if not in draft mode
      let image;
      if (!draftMode) {
        image = captureDrawingImage(pdfCanvasRef?.current || null, canvas, boundingBox);
      }

      // Store the drawing data temporarily
      setPendingDrawingData({
        normalizedPinPoint,
        normalizedBendPoint,
        normalizedBoundingBox,
        image,
      });

      // Open the dialog to get text input
      setIsDialogOpen(true);
    }
  };

  // Handle keyboard events for accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Trigger click handler when Enter or Space is pressed
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick(e as unknown as React.MouseEvent<HTMLCanvasElement>);
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={classes.extensionLineCanvas}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onKeyDown={handleKeyDown}
        tabIndex={0} // Make canvas focusable
        data-testid='extensionLine-drawing-canvas'
      />
      <TextInputDialog isOpen={isDialogOpen} onClose={handleDialogClose} onSubmit={handleDialogSubmit} />
    </>
  );
};
