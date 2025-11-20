import React, { useEffect, useRef, useState, useContext } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { normalizeCoordinatesToZeroRotation } from '../../utils/rotationUtils';
import { Drawing, ImageAnnotation } from '../../model/types/Drawings';
import { resizeImageToFit } from '../../utils/resizeImageToFit';
import classes from './ImageLayer.module.scss'; // Assuming you have a similar CSS module

interface ImageLayerProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Drawing) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the main PDF canvas
  draftMode?: boolean;
}

export const ImageLayer = (props: ImageLayerProps) => {
  const { pageNumber, onDrawingCreated, pdfCanvasRef, draftMode = false } = props;
  const { state, dispatch } = useContext(ViewerContext);
  const { scale, drawingMode, pageRotations } = state;
  const rotation = pageRotations[pageNumber] || 0;

  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Rectangle selection state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [endPoint, setEndPoint] = useState<{ x: number; y: number } | null>(null);

  // Dialog position state
  const [dialogPosition, setDialogPosition] = useState<{ top: number; left: number } | null>(null);

  // Set up overlay canvas dimensions
  useEffect(() => {
    if (!overlayCanvasRef.current) return;
    const canvas = overlayCanvasRef.current;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
  }, [scale, pageNumber]);

  // Get raw coordinates relative to the overlay canvas
  const getRawCoordinates = (clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!overlayCanvasRef.current) return null;
    const canvas = overlayCanvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  // Common logic to start drawing
  const beginDrawing = (clientX: number, clientY: number) => {
    if (drawingMode !== 'image') return;

    const clickCoords = getRawCoordinates(clientX, clientY);
    if (!clickCoords) return;

    setIsDrawing(true);
    setStartPoint(clickCoords);
    setEndPoint(clickCoords);
  };

  // Start drawing selection rectangle (mouse)
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    beginDrawing(e.clientX, e.clientY);
  };

  // Start drawing selection rectangle (touch)
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return; // Only single touch
    const touch = e.touches[0];
    beginDrawing(touch.clientX, touch.clientY);
  };

  // Common logic to update selection
  const updateSelection = (clientX: number, clientY: number) => {
    if (!isDrawing || !startPoint || drawingMode !== 'image') return;

    const moveCoords = getRawCoordinates(clientX, clientY);
    if (!moveCoords) return;

    setEndPoint(moveCoords);

    // Draw the selection rectangle
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate rectangle dimensions
    const x = Math.min(startPoint.x, moveCoords.x);
    const y = Math.min(startPoint.y, moveCoords.y);
    const width = Math.abs(moveCoords.x - startPoint.x);
    const height = Math.abs(moveCoords.y - startPoint.y);

    // Draw semi-transparent fill
    ctx.fillStyle = 'rgba(0, 119, 255, 0.1)';
    ctx.fillRect(x, y, width, height);

    // Draw dashed rectangle border
    ctx.beginPath();
    ctx.strokeStyle = '#0077FF';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.rect(x, y, width, height);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Update the selection rectangle as mouse moves
  const drawSelectionRectangle = (e: React.MouseEvent<HTMLCanvasElement>) => {
    updateSelection(e.clientX, e.clientY);
  };

  // Update the selection rectangle as touch moves
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return; // Only single touch
    e.preventDefault(); // Prevent scrolling while drawing
    const touch = e.touches[0];
    updateSelection(touch.clientX, touch.clientY);
  };

  // Common logic to finish drawing
  const finishDrawing = () => {
    if (!isDrawing) return;

    // Set drawing state to false immediately to stop tracking
    setIsDrawing(false);

    if (!startPoint || !endPoint || drawingMode !== 'image') {
      resetDrawing();
      return;
    }

    // Prevent tiny selections (probably accidental clicks)
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    if (width < 20 || height < 20) {
      resetDrawing();
      return;
    }

    // Show dialog near the center of the selection
    const centerX = (startPoint.x + endPoint.x) / 2;
    const centerY = (startPoint.y + endPoint.y) / 2;

    // Get viewport coordinates for dialog positioning
    const canvas = overlayCanvasRef.current;
    if (!canvas) {
      resetDrawing();
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const dialogX = rect.left + centerX;
    const dialogY = rect.top + centerY;

    setDialogPosition({ left: dialogX, top: dialogY });

    // Keep the selection rectangle visible even after releasing the mouse
    drawStaticSelectionRectangle();
  };

  // Finish drawing (mouse)
  const endDrawing = (_e: React.MouseEvent<HTMLCanvasElement>) => {
    finishDrawing();
  };

  // Finish drawing (touch)
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    finishDrawing();
  };

  // Draw a static selection rectangle (doesn't follow mouse)
  const drawStaticSelectionRectangle = () => {
    if (!startPoint || !endPoint || !overlayCanvasRef.current) return;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculate rectangle dimensions
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    // Draw semi-transparent fill
    ctx.fillStyle = 'rgba(0, 119, 255, 0.1)';
    ctx.fillRect(x, y, width, height);

    // Draw dashed rectangle border
    ctx.beginPath();
    ctx.strokeStyle = '#0077FF';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.rect(x, y, width, height);
    ctx.stroke();
    ctx.setLineDash([]);
  };

  // Reset drawing state and clear the canvas
  const resetDrawing = () => {
    setIsDrawing(false);
    setStartPoint(null);
    setEndPoint(null);

    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  // Handler for the "Select File" button in the dialog
  const handleSelectFileClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  // Handler for touch on the "Select File" button
  const handleSelectFileTouch = (e: React.TouchEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent the click event from firing after touch
    fileInputRef.current?.click();
  };

  // Close dialog if user clicks outside or presses Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node) && dialogPosition) {
        setDialogPosition(null);
        resetDrawing();
        if (!draftMode) dispatch({ type: 'setDrawingMode', payload: 'none' });
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dialogPosition) {
        setDialogPosition(null);
        resetDrawing();
        if (!draftMode) dispatch({ type: 'setDrawingMode', payload: 'none' });
      }
    };

    if (dialogPosition) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [dialogPosition, dispatch]);

  // Process image and create annotation
  const processAndCreateImageAnnotation = async (file: File | null) => {
    if (!file || !startPoint || !endPoint || !pdfCanvasRef?.current) {
      console.log('Missing required data for image annotation.');
      resetDrawing();
      setDialogPosition(null);
      if (!draftMode) dispatch({ type: 'setDrawingMode', payload: 'none' });
      return;
    }

    try {
      // Get pixel dimensions of the selection area
      const selectionWidth = Math.abs(endPoint.x - startPoint.x);
      const selectionHeight = Math.abs(endPoint.y - startPoint.y);

      // Get coordinates in screen space
      const screenStartX = Math.min(startPoint.x, endPoint.x);
      const screenStartY = Math.min(startPoint.y, endPoint.y);
      const screenEndX = Math.max(startPoint.x, endPoint.x);
      const screenEndY = Math.max(startPoint.y, endPoint.y);

      // Center point of selection in screen space
      const centerX = (screenStartX + screenEndX) / 2;
      const centerY = (screenStartY + screenEndY) / 2;

      // Resize image to fit the selected area while maintaining aspect ratio
      const { dataUrl, dimensions } = await resizeImageToFit(file, selectionWidth, selectionHeight);

      // Recalculate start/end points to center the image in the selection
      const imageStartX = centerX - dimensions.width / 2;
      const imageStartY = centerY - dimensions.height / 2;
      const imageEndX = imageStartX + dimensions.width;
      const imageEndY = imageStartY + dimensions.height;

      // Normalized coordinates for scale and rotation - now using the centered image dimensions
      const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
        { x: imageStartX, y: imageStartY },
        pdfCanvasRef.current.width,
        pdfCanvasRef.current.height,
        scale,
        rotation,
      );

      const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
        { x: imageEndX, y: imageEndY },
        pdfCanvasRef.current.width,
        pdfCanvasRef.current.height,
        scale,
        rotation,
      );

      // Create the annotation
      const newAnnotation: ImageAnnotation = {
        id: '',
        type: 'image',
        pageNumber,
        startPoint: normalizedStartPoint,
        endPoint: normalizedEndPoint,
        image: dataUrl,
        boundingBox: {
          left: normalizedStartPoint.x,
          top: normalizedStartPoint.y,
          right: normalizedEndPoint.x,
          bottom: normalizedEndPoint.y,
        },
      };

      onDrawingCreated(newAnnotation);
    } catch (error) {
      console.error('Error processing image for annotation:', error);
    } finally {
      resetDrawing();
      setDialogPosition(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (!draftMode) dispatch({ type: 'setDrawingMode', payload: 'none' });
    }
  };

  // Handler for file input change
  const handleFileSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    processAndCreateImageAnnotation(file || null);
  };

  // Handler for paste events
  const handleGlobalPaste = async (event: ClipboardEvent) => {
    const target = event.target as HTMLElement;
    if (
      !dialogPosition || // Dialog must be open (meaning selection is active)
      drawingMode !== 'image' ||
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
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
      await processAndCreateImageAnnotation(imageFile);
    }
  };

  // Add/remove paste listener to window
  useEffect(() => {
    window.addEventListener('paste', handleGlobalPaste);
    return () => {
      window.removeEventListener('paste', handleGlobalPaste);
    };
  }, [dialogPosition, startPoint, endPoint]);

  return (
    <>
      {drawingMode === 'image' && (
        <canvas
          ref={overlayCanvasRef}
          className={classes.imageLayerCanvas}
          onMouseDown={startDrawing}
          onMouseMove={drawSelectionRectangle}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          data-testid={`image-layer-canvas-${pageNumber}`}
        />
      )}

      {dialogPosition && (
        <div
          className={classes.imageDialog}
          style={{
            left: `${dialogPosition.left}px`,
            top: `${dialogPosition.top}px`,
            position: 'fixed',
            transform: 'translate(-50%, -50%)',
          }}
          ref={dialogRef}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}>
          <div className={classes.dialogContent}>
            <span className={classes.dialogText}>{'Вставьте картинку из буфера или'}</span>
            <button onClick={handleSelectFileClick} onTouchEnd={handleSelectFileTouch} className={classes.dialogButton}>
              {'Выберите файл...'}
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
