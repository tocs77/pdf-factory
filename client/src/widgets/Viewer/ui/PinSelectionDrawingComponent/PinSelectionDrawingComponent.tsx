import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { PinSelection } from '../../model/types/viewerSchema';
import styles from './PinSelectionDrawingComponent.module.scss';

interface PinSelectionDrawingComponentProps {
  pageNumber: number;
  onDrawingCreated: (drawing: PinSelection) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the PDF canvas
}

// Define capture area dimensions (adjust as needed)
const CAPTURE_AREA_WIDTH = 100;
const CAPTURE_AREA_HEIGHT = 100;

/**
 * Component for handling pin placement by clicking and capturing the surrounding area.
 */
const PinSelectionDrawingComponent = (props: PinSelectionDrawingComponentProps) => {
  const { pageNumber, onDrawingCreated, pdfCanvasRef } = props;
  const { state } = useContext(ViewerContext);
  const { scale, drawingMode, pageRotations, drawingColor } = state;
  const rotation = pageRotations[pageNumber] || 0;
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Set up drawing canvas dimensions (needed for coordinate calculations and bounds checks)
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    } else {
      console.warn('No parent element found for canvas');
    }
    // No need to clear context here as we are not drawing anything on this canvas
  }, [scale, pageNumber, rotation]);

  const getRawCoordinates = (clientX: number, clientY: number): { x: number; y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    return { x, y };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || drawingMode !== 'PinSelection' || !canvasRef.current || !pdfCanvasRef?.current) {
      return; // Only left button, correct mode, and refs available
    }

    const canvas = canvasRef.current;
    const pdfCanvas = pdfCanvasRef.current;

    // 1. Get click coordinates
    const clickPoint = getRawCoordinates(e.clientX, e.clientY);

    // 2. Calculate initial capture area (centered around click point)
    let captureLeft = clickPoint.x - CAPTURE_AREA_WIDTH / 2;
    let captureTop = clickPoint.y - CAPTURE_AREA_HEIGHT / 2;

    // 3. Adjust capture area to stay within canvas bounds
    // Check left boundary
    if (captureLeft < 0) {
      captureLeft = 0;
    }
    // Check top boundary
    if (captureTop < 0) {
      captureTop = 0;
    }
    // Check right boundary
    if (captureLeft + CAPTURE_AREA_WIDTH > canvas.width) {
      captureLeft = canvas.width - CAPTURE_AREA_WIDTH;
    }
    // Check bottom boundary
    if (captureTop + CAPTURE_AREA_HEIGHT > canvas.height) {
      captureTop = canvas.height - CAPTURE_AREA_HEIGHT;
    }
    // Ensure capture area isn't negative if dimensions are larger than canvas
    captureLeft = Math.max(0, captureLeft);
    captureTop = Math.max(0, captureTop);

    // 4. Define the final bounding box for capture
    const boundingBoxForCapture = {
      left: captureLeft,
      top: captureTop,
      width: CAPTURE_AREA_WIDTH,
      height: CAPTURE_AREA_HEIGHT,
    };

    // 5. Capture the image
    const capturedImage = captureDrawingImage(
      pdfCanvas,
      null, // No drawing overlay
      boundingBoxForCapture,
      false, // Don't require drawing overlay
    );

    // 6. Normalize the original click coordinates
    const normalizedPosition = normalizeCoordinatesToZeroRotation(
      clickPoint, // Use the actual click point for the pin position
      canvas.width,
      canvas.height,
      scale,
      rotation,
    );

    // 7. Create the PinSelection object
    const newPinSelection: PinSelection = {
      id: '',
      type: 'PinSelection',
      position: normalizedPosition,
      pageNumber,
      image: capturedImage,
      color: drawingColor,
      // Bounding box refers to the *pin* location, not the capture area necessarily
      // For simplicity, create a small box around the pin
      boundingBox: {
        left: normalizedPosition.x - 5, // Small box around the pin
        top: normalizedPosition.y - 5,
        right: normalizedPosition.x + 5,
        bottom: normalizedPosition.y + 5,
      },
    };

    // 8. Call the callback
    onDrawingCreated(newPinSelection);

    // Note: No need to clear the canvas as nothing was drawn
    // Optionally switch mode back to none
    // dispatch({ type: 'setDrawingMode', payload: 'none' });
  };

  return (
    <canvas
      ref={canvasRef}
      className={styles.drawingCanvas} // Apply cursor style
      onClick={handleCanvasClick} // Use onClick for simplicity
      data-testid='pin-selection-canvas'
    />
  );
};

export default PinSelectionDrawingComponent;
