import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import styles from './PinDrawingComponent.module.scss';

interface PinDrawingComponentProps {
  pageNumber: number;
}

/**
 * Component for handling pin drawing
 */
const PinDrawingComponent: React.FC<PinDrawingComponentProps> = ({ pageNumber }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);

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

  // Handle pin placement
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);

    // Normalize coordinates to scale 1 and 0 degrees rotation
    const normalizedPoint = normalizeCoordinatesToZeroRotation(
      point, 
      canvas.width, 
      canvas.height, 
      scale, 
      rotation
    );

    // Prompt for pin text
    const text = prompt('Enter pin text:');
    if (!text) {
      return;
    }

    // Create a new pin object with normalized coordinates
    const newPin = {
      position: normalizedPoint,
      text,
      color: drawingColor,
      pageNumber,
    };

    // Add the pin to the context
    dispatch({ type: 'addPin', payload: newPin });
  };

  return <canvas ref={canvasRef} className={styles.pinCanvas} onClick={handleClick} data-testid='pin-drawing-canvas' />;
};

export default PinDrawingComponent;
