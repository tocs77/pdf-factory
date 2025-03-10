import React, { useEffect, useRef, useContext, useState } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { renderPin } from '../../utils/pinRenderer';
import styles from './PinDrawingComponent.module.scss';

interface PinDrawingComponentProps {
  pageNumber: number;
}

/**
 * Component for handling pin drawing with arrow and bend point
 */
const PinDrawingComponent: React.FC<PinDrawingComponentProps> = ({ pageNumber }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, pageRotations, drawingMode } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // States for tracking the multi-stage drawing process
  const [drawingStage, setDrawingStage] = useState<'initial' | 'positioning' | 'completed'>('initial');
  const [pinPosition, setPinPosition] = useState<{ x: number; y: number } | null>(null);
  const [bendPosition, setBendPosition] = useState<{ x: number; y: number } | null>(null);
  const [currentMousePosition, setCurrentMousePosition] = useState<{ x: number; y: number } | null>(null);

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
    setPinPosition(null);
    setBendPosition(null);
    setCurrentMousePosition(null);
    setDrawingStage('initial');
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

  // Draw the pin and arrow preview
  useEffect(() => {
    if (!canvasRef.current || !pinPosition) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (drawingStage === 'positioning' && currentMousePosition) {
      // If we're in the positioning stage, draw a preview of the arrow
      const previewPin = {
        position: pinPosition,
        bendPoint: bendPosition || currentMousePosition,
        text: "",
        color: drawingColor,
        pageNumber
      };

      // Draw the pin with the current mouse position as the bend point
      renderPin(ctx, previewPin, pinPosition.x, pinPosition.y);
    }
  }, [pinPosition, bendPosition, currentMousePosition, drawingStage, drawingColor, pageNumber]);

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

  // Handle clicks for pin placement
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const point = getRawCoordinates(e.clientX, e.clientY);

    if (drawingStage === 'initial') {
      // First click: Set the pin position (arrow end)
      setPinPosition(point);
      setDrawingStage('positioning');
    } else if (drawingStage === 'positioning') {
      // Second click: Set the bend point
      setBendPosition(point);
      
      // Normalize coordinates to scale 1 and 0 degrees rotation
      const normalizedPinPoint = normalizeCoordinatesToZeroRotation(
        pinPosition!, 
        canvas.width, 
        canvas.height, 
        scale, 
        rotation
      );
      
      const normalizedBendPoint = normalizeCoordinatesToZeroRotation(
        point, 
        canvas.width, 
        canvas.height, 
        scale, 
        rotation
      );

      // Prompt for pin text
      const text = prompt('Enter pin text:');
      if (!text) {
        // Reset if user cancels
        setPinPosition(null);
        setBendPosition(null);
        setDrawingStage('initial');
        return;
      }

      // Create a new pin object with normalized coordinates
      const newPin = {
        position: normalizedPinPoint,
        bendPoint: normalizedBendPoint,
        text,
        color: drawingColor,
        pageNumber,
        canvasDimensions: {
          width: canvas.width / scale,
          height: canvas.height / scale
        },
        rotation: rotation as 0 | 90 | 180 | 270
      };

      // Add the pin to the context
      dispatch({ type: 'addPin', payload: newPin });

      // Reset drawing state
      setPinPosition(null);
      setBendPosition(null);
      setCurrentMousePosition(null);
      setDrawingStage('initial');
      
      // Clear the canvas as the pin will be rendered by CompleteDrawings
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  return (
    <canvas 
      ref={canvasRef} 
      className={styles.pinCanvas} 
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      data-testid='pin-drawing-canvas' 
    />
  );
};

export default PinDrawingComponent;
