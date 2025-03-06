import React, { useEffect, useRef, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { RotationAngle } from '../../model/types/viewerSchema';
import styles from './PinDrawingComponent.module.scss';

interface PinDrawingComponentProps {
  pageNumber: number;
}

/**
 * Component for handling pin drawing
 * This component is only visible when text layer is disabled
 */
const PinDrawingComponent: React.FC<PinDrawingComponentProps> = ({ pageNumber }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, textLayerEnabled, pageRotations } = state;

  // Get the rotation angle for this page
  const rotation = pageRotations[pageNumber] || 0;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Set up drawing canvas
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled) return;

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
  }, [scale, textLayerEnabled, pageNumber, rotation]);

  // Set cursor to crosshair
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled) return;

    const canvas = canvasRef.current;

    const handleMouseEnter = () => {
      // Force the cursor to be a crosshair
      canvas.style.cursor = 'crosshair';
    };

    canvas.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      canvas.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [textLayerEnabled]);

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

  // Function to rotate a point around the center
  const rotatePoint = (
    x0: number,
    y0: number,
    xc: number,
    yc: number,
    theta: number
  ): { x: number; y: number } => {
    const radians = (theta * Math.PI) / 180;
    const x1 = (x0 - xc) * Math.cos(radians) - (y0 - yc) * Math.sin(radians) + xc;
    const y1 = (x0 - xc) * Math.sin(radians) + (y0 - yc) * Math.cos(radians) + yc;
    return { x: x1, y: y1 };
  };

  // Transform coordinates from current rotation to 0 degrees
  const normalizeCoordinatesToZeroRotation = (
    point: { x: number, y: number },
    canvasWidth: number,
    canvasHeight: number
  ): { x: number, y: number } => {
    // Convert to coordinates at scale 1
    const scaleAdjustedX = point.x / scale;
    const scaleAdjustedY = point.y / scale;
    
    // Center of the canvas at scale 1
    const centerX = canvasWidth / (2 * scale);
    const centerY = canvasHeight / (2 * scale);
    
    // Apply inverse rotation (negative angle)
    return rotatePoint(scaleAdjustedX, scaleAdjustedY, centerX, centerY, -rotation);
  };

  // Handle pin placement
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (textLayerEnabled) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    // Get raw coordinates
    const point = getRawCoordinates(e.clientX, e.clientY);

    // Normalize coordinates to scale 1 and 0 degrees rotation
    const normalizedPoint = normalizeCoordinatesToZeroRotation(point, canvas.width, canvas.height);

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
      rotation: rotation as RotationAngle, // Store the rotation at which the pin was created
    };

    // Add the pin to the context
    dispatch({ type: 'addPin', payload: newPin });
  };

  return <canvas ref={canvasRef} className={styles.pinCanvas} onClick={handleClick} data-testid='pin-drawing-canvas' />;
};

export default PinDrawingComponent;
