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
  // Store canvas dimensions at the time of drawing
  const [canvasDimensions, setCanvasDimensions] = React.useState<{ width: number; height: number } | null>(null);

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
      
      // Store current canvas dimensions at scale=1
      setCanvasDimensions({
        width: canvas.width / scale,
        height: canvas.height / scale
      });
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
  const getRawCoordinates = (clientX: number, clientY: number): { x: number, y: number } => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Get mouse position relative to canvas
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    return { x, y };
  };

  // Transform coordinates from current rotation to 0 degrees
  const normalizeCoordinatesToZeroRotation = (
    point: { x: number, y: number },
    canvasWidth: number,
    canvasHeight: number
  ): { x: number, y: number } => {
    // First normalize to [0,1] range
    const normalizedX = point.x / canvasWidth;
    const normalizedY = point.y / canvasHeight;
    
    // Calculate center point
    const centerX = 0.5;
    const centerY = 0.5;
    
    // Translate to origin (center of canvas)
    const translatedX = normalizedX - centerX;
    const translatedY = normalizedY - centerY;
    
    // Apply inverse rotation
    let rotatedX, rotatedY;
    
    if (rotation === 90) {
      // Inverse of 90 degrees is -90 degrees (or 270 degrees)
      rotatedX = translatedY;
      rotatedY = -translatedX;
    } else if (rotation === 180) {
      // Inverse of 180 degrees is -180 degrees (or 180 degrees)
      rotatedX = -translatedX;
      rotatedY = -translatedY;
    } else if (rotation === 270) {
      // Inverse of 270 degrees is -270 degrees (or 90 degrees)
      rotatedX = -translatedY;
      rotatedY = translatedX;
    } else {
      // No rotation (0 degrees)
      rotatedX = translatedX;
      rotatedY = translatedY;
    }
    
    // Translate back from origin
    const finalX = rotatedX + centerX;
    const finalY = rotatedY + centerY;
    
    // Ensure coordinates are within [0,1] range
    return {
      x: Math.max(0, Math.min(1, finalX)),
      y: Math.max(0, Math.min(1, finalY))
    };
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
    
    // Update canvas dimensions
    setCanvasDimensions({
      width: canvas.width,
      height: canvas.height
    });
    
    // Normalize coordinates to scale 1 and 0 degrees rotation
    const normalizedPoint = normalizeCoordinatesToZeroRotation(
      point,
      canvas.width,
      canvas.height
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
      rotation: rotation as RotationAngle, // Store the rotation at which the pin was created
    };
    
    // Add the pin to the context
    dispatch({ type: 'addPin', payload: newPin });
  };

  return (
    <canvas
      ref={canvasRef}
      className={styles.pinCanvas}
      onClick={handleClick}
      data-testid="pin-drawing-canvas"
    />
  );
};

export default PinDrawingComponent; 