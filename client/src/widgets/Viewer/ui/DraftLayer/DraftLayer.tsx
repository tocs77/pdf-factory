import { useContext, useState, useRef } from 'react';
import { ViewerContext } from '../../model/context/viewerContext';
import { Drawing, DrawingMisc } from '../../model/types/viewerSchema';
import { LineDrawingLayer } from '../LineDrawingLayer/LineDrawingLayer';
import TextAreaDrawingLayer from '../TextAreaDrawingLayer/TextAreaDrawingLayer';
import { DrawingComponent } from '../DrawingComponent/DrawingComponent';
import DrawRect from '../DrawRect/DrawRect';
import CompleteDrawings from '../CompleteDrawings/CompleteDrawings';
import styles from '../DrawingComponent/DrawingComponent.module.scss'; // Import styles
import { transformCoordinates } from '../../utils/rotationUtils';
import { captureDrawingImage } from '../../utils/captureDrawingImage';
import { ExtensionLineDrawingComponent } from '../ExtensionLineDrawingComponent/ExtensionLineDrawingComponent';

interface DraftLayerProps {
  pageNumber: number;
  onDrawingCreated: (drawing: Omit<Drawing, 'id'>) => void;
  pdfCanvasRef?: React.RefObject<HTMLCanvasElement>; // Reference to the PDF canvas
}

export const DraftLayer = (props: DraftLayerProps) => {
  const { pageNumber, onDrawingCreated, pdfCanvasRef } = props;
  const completeDrawingsCanvasRef = useRef<HTMLCanvasElement>(null); // Ref for CompleteDrawings canvas
  const { state, dispatch } = useContext(ViewerContext); // Get dispatch
  const { drawingMode, currentDrawingPage } = state;

  const [draftDrawing, setDraftDrawing] = useState<DrawingMisc>({
    id: '',
    type: 'misc',
    pathes: [],
    rectangles: [],
    extensionLines: [],
    lines: [],
    textAreas: [],
    pageNumber: pageNumber,
    boundingBox: { left: 0, top: 0, right: 0, bottom: 0 },
  });

  const handleDrawingAdded = (drawing: Drawing) => {
    switch (drawing.type) {
      case 'freehand':
        setDraftDrawing((prev) => ({ ...prev, pathes: [...prev.pathes, drawing] }));
        break;
      case 'rectangle':
        setDraftDrawing((prev) => ({ ...prev, rectangles: [...prev.rectangles, drawing] }));
        break;
      case 'extensionLine':
        setDraftDrawing((prev) => ({ ...prev, extensionLines: [...prev.extensionLines, drawing] }));
        break;
      case 'line':
        setDraftDrawing((prev) => ({ ...prev, lines: [...prev.lines, drawing] }));
        break;
      case 'textArea':
        setDraftDrawing((prev) => ({ ...prev, textAreas: [...prev.textAreas, drawing] }));
        break;
      default:
        break;
    }
    dispatch({ type: 'setCurrentDrawingPage', payload: pageNumber });
  };

  // Helper to update normalized bounding box from another bounding box
  const updateBoundsFromBox = (
    targetBounds: { minX: number; minY: number; maxX: number; maxY: number },
    sourceBox: { left: number; top: number; right: number; bottom: number } | undefined,
  ) => {
    if (!sourceBox) return; // Skip if the drawing doesn't have a bounding box
    targetBounds.minX = Math.min(targetBounds.minX, sourceBox.left);
    targetBounds.minY = Math.min(targetBounds.minY, sourceBox.top);
    targetBounds.maxX = Math.max(targetBounds.maxX, sourceBox.right);
    targetBounds.maxY = Math.max(targetBounds.maxY, sourceBox.bottom);
  };

  const handleFinish = () => {
    const hasDrawing =
      draftDrawing.pathes.length > 0 ||
      draftDrawing.rectangles.length > 0 ||
      draftDrawing.extensionLines.length > 0 ||
      draftDrawing.lines.length > 0 ||
      draftDrawing.textAreas.length > 0;

    if (hasDrawing) {
      createDraftDrawing();
    }

    dispatch({ type: 'setCurrentDrawingPage', payload: 0 }); // allow drawing on all pages
    // Optionally clear the draft state
    setDraftDrawing({
      id: '',
      type: 'misc',
      pathes: [],
      rectangles: [],
      extensionLines: [],
      lines: [],
      textAreas: [],
      pageNumber: pageNumber,
      boundingBox: { left: 0, top: 0, right: 0, bottom: 0 },
    });
  };

  const createDraftDrawing = () => {
    const drawingsCanvas = completeDrawingsCanvasRef.current;
    const pdfCanvas = pdfCanvasRef?.current;
    if (!drawingsCanvas || !pdfCanvas) {
      console.error('Cannot capture image: Missing PDF or Drawings canvas ref');
      // Still create the drawing object without image/bounds if canvases missing
      const drawing: DrawingMisc = {
        id: '',
        type: 'misc',
        pageNumber: pageNumber,
        pathes: draftDrawing.pathes,
        rectangles: draftDrawing.rectangles,
        extensionLines: draftDrawing.extensionLines,
        lines: draftDrawing.lines,
        textAreas: draftDrawing.textAreas,
        image: '',
        boundingBox: { left: 0, top: 0, right: 0, bottom: 0 }, // Default empty bounds
      };
      onDrawingCreated(drawing);
      return;
    }

    // Calculate combined bounding box using existing NORMALIZED bounding boxes
    const combinedNormalizedBounds = {
      minX: Number.MAX_VALUE,
      minY: Number.MAX_VALUE,
      maxX: 0,
      maxY: 0,
    };

    // Iterate through all drawings and combine their bounding boxes
    draftDrawing.pathes.forEach((drawing) => updateBoundsFromBox(combinedNormalizedBounds, drawing.boundingBox));
    draftDrawing.rectangles.forEach((drawing) => updateBoundsFromBox(combinedNormalizedBounds, drawing.boundingBox));
    draftDrawing.extensionLines.forEach((drawing) => updateBoundsFromBox(combinedNormalizedBounds, drawing.boundingBox));
    draftDrawing.lines.forEach((drawing) => updateBoundsFromBox(combinedNormalizedBounds, drawing.boundingBox));
    draftDrawing.textAreas.forEach((drawing) => updateBoundsFromBox(combinedNormalizedBounds, drawing.boundingBox));

    // Create the final bounding box for the DrawingMisc object
    const finalMiscBoundingBox = {
      left: combinedNormalizedBounds.minX === Number.MAX_VALUE ? 0 : combinedNormalizedBounds.minX,
      top: combinedNormalizedBounds.minY === Number.MAX_VALUE ? 0 : combinedNormalizedBounds.minY,
      right: combinedNormalizedBounds.maxX,
      bottom: combinedNormalizedBounds.maxY,
    };

    // Transform the combined NORMALIZED min/max points to screen coordinates for image capture
    const currentScale = state.scale;
    const currentRotation = state.pageRotations[pageNumber] || 0;

    const { x: screenMinX, y: screenMinY } = transformCoordinates(
      finalMiscBoundingBox.left, // Use calculated final bounds
      finalMiscBoundingBox.top,
      pdfCanvas.width,
      pdfCanvas.height,
      currentScale,
      currentRotation,
    );
    const { x: screenMaxX, y: screenMaxY } = transformCoordinates(
      finalMiscBoundingBox.right,
      finalMiscBoundingBox.bottom,
      pdfCanvas.width,
      pdfCanvas.height,
      currentScale,
      currentRotation,
    );

    // Add padding and calculate the final screen bounding box for capture
    const padding = 10;
    const finalCaptureBounds = {
      left: Math.max(0, Math.min(screenMinX, screenMaxX) - padding),
      top: Math.max(0, Math.min(screenMinY, screenMaxY) - padding),
      width: 0,
      height: 0,
    };
    finalCaptureBounds.width = Math.min(
      pdfCanvas.width - finalCaptureBounds.left,
      Math.abs(screenMaxX - screenMinX) + padding * 2,
    );
    finalCaptureBounds.height = Math.min(
      pdfCanvas.height - finalCaptureBounds.top,
      Math.abs(screenMaxY - screenMinY) + padding * 2,
    );

    let image = '';
    if (finalCaptureBounds.width > 0 && finalCaptureBounds.height > 0) {
      image = captureDrawingImage(
        pdfCanvasRef?.current || null,
        completeDrawingsCanvasRef.current || null,
        finalCaptureBounds, // Use capture bounds
        true,
      );
    }

    const drawing: DrawingMisc = {
      id: '',
      type: 'misc',
      pageNumber: pageNumber,
      pathes: draftDrawing.pathes,
      rectangles: draftDrawing.rectangles,
      extensionLines: draftDrawing.extensionLines,
      lines: draftDrawing.lines,
      textAreas: draftDrawing.textAreas,
      image: image,
      boundingBox: finalMiscBoundingBox, // Add the calculated combined bounds
    };
    onDrawingCreated(drawing);
  };

  const handleCancel = () => {
    // Reset state with boundingBox
    dispatch({ type: 'setCurrentDrawingPage', payload: -1 });
    setDraftDrawing({
      id: '',
      type: 'misc',
      pathes: [],
      rectangles: [],
      extensionLines: [],
      lines: [],
      textAreas: [],
      pageNumber: pageNumber,
      boundingBox: { left: 0, top: 0, right: 0, bottom: 0 },
    });
  };

  return (
    <>
      {/* Add Finish and Cancel buttons like in DrawingComponent */}
      {currentDrawingPage === pageNumber && (
        <div className={styles.finishButtonContainer}>
          <button className={styles.finishButton} onClick={handleFinish}>
            <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
              <polyline points='20 6 9 17 4 12'></polyline>
            </svg>
            <span>Finish</span>
          </button>
          <button className={`${styles.finishButton} ${styles.cancelButton}`} onClick={handleCancel}>
            <svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='currentColor'>
              <line x1='18' y1='6' x2='6' y2='18'></line>
              <line x1='6' y1='6' x2='18' y2='18'></line>
            </svg>
            <span>Cancel</span>
          </button>
        </div>
      )}
      {drawingMode === 'freehand' && (
        <DrawingComponent pageNumber={pageNumber} onDrawingCreated={handleDrawingAdded} pdfCanvasRef={pdfCanvasRef} draftMode />
      )}
      {drawingMode === 'rectangle' && (
        <DrawRect pageNumber={pageNumber} onDrawingCreated={handleDrawingAdded} pdfCanvasRef={pdfCanvasRef} draftMode />
      )}
      {drawingMode === 'extensionLine' && (
        <ExtensionLineDrawingComponent
          pageNumber={pageNumber}
          onDrawingCreated={handleDrawingAdded}
          pdfCanvasRef={pdfCanvasRef}
          draftMode
        />
      )}
      {drawingMode === 'line' && (
        <LineDrawingLayer pageNumber={pageNumber} onDrawingCreated={handleDrawingAdded} pdfCanvasRef={pdfCanvasRef} draftMode />
      )}
      {drawingMode === 'textArea' && (
        <TextAreaDrawingLayer
          pageNumber={pageNumber}
          onDrawingCreated={handleDrawingAdded}
          pdfCanvasRef={pdfCanvasRef}
          draftMode
        />
      )}
      {/* Removed temporary canvas */}
      <CompleteDrawings ref={completeDrawingsCanvasRef} pageNumber={pageNumber} drawings={[draftDrawing]} />
    </>
  );
};
