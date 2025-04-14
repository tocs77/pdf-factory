import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { ImageAnnotation } from '../../model/types/viewerSchema';
import classes from './ImageLayer.module.scss'; // Assuming you have a similar CSS module

interface ImageLayerProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Omit<ImageAnnotation, 'id'>) => void;
  pdfCanvasRef: React.RefObject<HTMLCanvasElement>; // Reference to the main PDF canvas
}

// Constant for image resizing
const IMAGE_MAX_LENGTH = 300;

// Helper function to resize image
async function resizeImageBeforeBase64(
  file: File,
  maxWidth: number,
  maxHeight: number,
  quality: number = 0.85,
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round(height * (maxWidth / width));
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round(width * (maxHeight / height));
            height = maxHeight;
          }
        }
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round(width * (maxHeight / height));
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Could not get canvas context'));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve({ dataUrl, width, height });
      };
      img.onerror = reject;
      if (event.target?.result) img.src = event.target.result as string;
      else reject(new Error('FileReader did not return a result.'));
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ImageLayer: React.FC<ImageLayerProps> = ({ pageNumber, onDrawingCreated, pdfCanvasRef }) => {
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingMode, pageRotations } = state;
  const rotation = pageRotations[pageNumber] || 0;

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePlacementPos, setImagePlacementPos] = useState<{ x: number; y: number } | null>(null);
  const [dialogPosition, setDialogPosition] = useState<{ top: number; left: number } | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  // Set up overlay canvas dimensions
  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    const canvas = overlayCanvasRef.current;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
  }, [scale, pageNumber]); // Removed rotation dependency

  // Get raw coordinates relative to the overlay canvas
  const getRawCoordinates = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!overlayCanvasRef.current) return null;
    const canvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Handler for clicks on the overlay when in 'image' mode
  const handleOverlayClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0 || drawingMode !== 'image' || !overlayCanvasRef.current || !pdfCanvasRef.current) {
      return;
    }

    const clickCoords = getRawCoordinates(e.clientX, e.clientY);
    if (!clickCoords) return;

    const pdfCanvas = pdfCanvasRef.current;
    if (!pdfCanvas) return;
    const normalizedPosition = normalizeCoordinatesToZeroRotation(
      clickCoords,
      pdfCanvas.offsetWidth,
      pdfCanvas.offsetHeight,
      scale,
      rotation,
    );

    setImagePlacementPos(normalizedPosition);
    setDialogPosition({ top: e.clientY, left: e.clientX });

    // REMOVE dispatch from here
    // dispatch({ type: 'setDrawingMode', payload: 'none' });
  };

  // NEW: Handler for the "Select File" button in the dialog
  const handleSelectFileClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation(); // Keep this to prevent other potential listeners
    fileInputRef.current?.click();
    // setDialogPosition(null); // REMOVE THIS LINE: Don't close dialog here
  };

  // Close dialog if user clicks outside or presses Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Check if the click target is outside the dialog
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target as Node) &&
        dialogPosition // Only act if the dialog is currently open
      ) {
        // Also check if the click was on the page canvas which might have triggered the dialog
        // This check helps prevent the initial click from closing the dialog immediately
        // It assumes the file input opening doesn't bubble up a click event itself.
        const isClickOnPage = pageRef.current?.contains(event.target as Node);
        if (!isClickOnPage || (isClickOnPage && event.target !== fileInputRef.current)) {
          setDialogPosition(null);
          setImagePlacementPos(null);
          dispatch({ type: 'setDrawingMode', payload: 'none' }); // Reset mode
        }
      }
    };
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dialogPosition) {
        setDialogPosition(null);
        setImagePlacementPos(null);
        dispatch({ type: 'setDrawingMode', payload: 'none' }); // Reset mode
      }
    };

    // Add listeners only when dialog might be visible
    if (dialogPosition) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [dialogPosition, dispatch, pageRef]); // Add pageRef dependency

  // Process image and create annotation
  const processAndCreateImageAnnotation = async (file: File | null, position: { x: number; y: number } | null) => {
    console.log('processAndCreateImageAnnotation', file, position);
    if (!file || !position) {
      console.log('No file or position for image annotation.');
      dispatch({ type: 'setDrawingMode', payload: 'none' }); // Keep this reset here for failure case
      return;
    }

    try {
      const {
        dataUrl,
        width: resizedPixelWidth,
        height: resizedPixelHeight,
      } = await resizeImageBeforeBase64(file, IMAGE_MAX_LENGTH, IMAGE_MAX_LENGTH);
      const normalizedWidth = resizedPixelWidth / scale;
      const normalizedHeight = resizedPixelHeight / scale;
      const newAnnotation: Omit<ImageAnnotation, 'id'> = {
        type: 'image',
        pageNumber: pageNumber,
        position: position,
        width: normalizedWidth,
        height: normalizedHeight,
        image: dataUrl,
        style: { rotation: 0, opacity: 1 },
        boundingBox: {
          left: position.x,
          top: position.y,
          right: position.x + normalizedWidth,
          bottom: position.y + normalizedHeight,
        },
      };
      console.log('newAnnotation', newAnnotation);
      onDrawingCreated(newAnnotation);
    } catch (error) {
      console.error('Error processing image for annotation:', error);
    } finally {
      setImagePlacementPos(null); // Reset placement position
      setDialogPosition(null); // Ensure dialog is closed
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      dispatch({ type: 'setDrawingMode', payload: 'none' }); // Keep reset here for success/finally case
    }
  };

  // Handler for file input change
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processAndCreateImageAnnotation(file || null, imagePlacementPos);
    // imagePlacementPos should be set if this is triggered
  };

  // Handler for paste events (bound to window)
  const handleGlobalPaste = async (event: ClipboardEvent) => {
    const target = event.target as HTMLElement;
    if (drawingMode !== 'image' || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }

    const items = event.clipboardData?.items;
    let imageFile: File | null = null;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          imageFile = items[i].getAsFile();
          break;
        }
      }
    }

    if (imageFile) {
      event.preventDefault();
      // Only process paste if the dialog was just shown (placement pos is set)
      if (!imagePlacementPos) return;

      await processAndCreateImageAnnotation(imageFile, imagePlacementPos);
      // Processing function now resets dialog/placement state and file input
      // Mode is reset by handleOverlayClick
    }
  };

  // Add/remove paste listener to window
  useEffect(() => {
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [imagePlacementPos, processAndCreateImageAnnotation]); // Depend on placementPos

  // Render only if drawing mode *was* 'image' (dialog might still be open)
  // Or simply always render the input, but the overlay only if mode is image?
  // Let's render the overlay only in image mode, but keep input and dialog logic

  return (
    <>
      {drawingMode === 'image' && (
        <canvas
          ref={overlayCanvasRef}
          className={classes.imageLayerCanvas}
          onClick={handleOverlayClick}
          data-testid={`image-layer-canvas-${pageNumber}`}
        />
      )}

      {/* Conditionally render the dialog */}
      {dialogPosition && (
        <div
          className={classes.imageDialog}
          style={{
            left: `${dialogPosition.left}px`,
            top: `${dialogPosition.top}px`,
            position: 'fixed', // Use fixed position for simplicity
            transform: 'translate(-50%, 10px)', // Position slightly below and centered horizontally relative to the cursor
          }}
          // Add ref and stop propagation if needed for handleClickOutside
          ref={dialogRef} // Add ref here
          onClick={(e) => e.stopPropagation()} // Prevent click inside closing dialog
          // Add mouse down propagation stop as well
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className={classes.dialogContent}>
            <span className={classes.dialogText}>Paste image or</span>
            <button onClick={handleSelectFileClick} className={classes.dialogButton}>
              Select file...
            </button>
          </div>
        </div>
      )}

      <input
        type='file'
        accept='image/*'
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelected}
        data-testid={`image-layer-input-${pageNumber}`}
      />
    </>
  );
};
