import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { Pin } from '../../model/types/viewerSchema';
import styles from './PinDrawingComponent.module.scss';

interface PinDrawingComponentProps {
  pageNumber: number;
}

/**
 * Component for handling the pin annotation process
 * This component is only visible when text layer is disabled and pin mode is active
 */
const PinDrawingComponent: React.FC<PinDrawingComponentProps> = ({
  pageNumber
}) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingColor, textLayerEnabled, drawingMode } = state;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showTextInput, setShowTextInput] = useState(false);
  const [pinText, setPinText] = useState('');
  const [pinPosition, setPinPosition] = useState<{ x: number; y: number } | null>(null);
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  // Set up canvas
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled || drawingMode !== 'pin') return;
    
    const canvas = canvasRef.current;
    
    // Set canvas dimensions based on parent container
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      
      // Store current canvas dimensions at scale=1
      setCanvasDimensions({
        width: parent.clientWidth / scale,
        height: parent.clientHeight / scale
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
  }, [scale, textLayerEnabled, pageNumber, drawingMode]);

  // Set cursor to pointer
  useEffect(() => {
    if (!canvasRef.current || textLayerEnabled || drawingMode !== 'pin') return;
    
    const canvas = canvasRef.current;
    
    const handleMouseEnter = () => {
      // Force the cursor to be a pointer
      canvas.style.cursor = 'pointer';
    };
    
    canvas.addEventListener('mouseenter', handleMouseEnter);
    
    return () => {
      canvas.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [textLayerEnabled, drawingMode]);

  // Focus text input when it appears
  useEffect(() => {
    if (showTextInput && textInputRef.current) {
      textInputRef.current.focus();
    }
  }, [showTextInput]);

  // Handle canvas click to place a pin
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (textLayerEnabled || drawingMode !== 'pin') {
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Update canvas dimensions if they've changed
    const parent = canvas.parentElement;
    if (parent) {
      setCanvasDimensions({
        width: parent.clientWidth / scale,
        height: parent.clientHeight / scale
      });
    }
    
    // Store the position where the pin will be placed
    setPinPosition({ x, y });
    setShowTextInput(true);
  };

  // Handle text input submission
  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pinPosition || !canvasDimensions) {
      return;
    }
    
    // Create a new pin
    const newPin: Pin = {
      position: {
        // Normalize coordinates to scale=1
        x: pinPosition.x / scale,
        y: pinPosition.y / scale
      },
      text: pinText,
      color: drawingColor,
      pageNumber,
      canvasDimensions
    };
    
    // Add the pin to the context
    dispatch({ type: 'addPin', payload: newPin });
    
    // Reset state
    setPinText('');
    setPinPosition(null);
    setShowTextInput(false);
  };

  // Handle cancel
  const handleCancel = () => {
    setPinText('');
    setPinPosition(null);
    setShowTextInput(false);
  };

  // Only render if in pin mode and text layer is disabled
  if (textLayerEnabled || drawingMode !== 'pin') {
    return null;
  }

  return (
    <div className={styles.pinDrawingContainer}>
      <canvas
        ref={canvasRef}
        className={styles.pinCanvas}
        onClick={handleCanvasClick}
      />
      
      {showTextInput && pinPosition && (
        <div 
          className={styles.textInputContainer}
          style={{
            left: pinPosition.x,
            top: pinPosition.y
          }}
        >
          <form onSubmit={handleTextSubmit}>
            <input
              ref={textInputRef}
              type="text"
              value={pinText}
              onChange={(e) => setPinText(e.target.value)}
              placeholder="Enter pin text..."
              className={styles.pinTextInput}
            />
            <div className={styles.buttonContainer}>
              <button type="submit" className={styles.submitButton}>Add</button>
              <button type="button" className={styles.cancelButton} onClick={handleCancel}>Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default PinDrawingComponent; 