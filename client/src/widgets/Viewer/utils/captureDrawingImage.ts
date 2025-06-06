/**
 * Utility function to capture an image of a drawing area on a PDF page
 *
 * @param pdfCanvas The main PDF canvas element
 * @param drawingCanvas The canvas with the drawing
 * @param boundingBox The bounding box of the drawing (or area to capture)
 * @param captureDrawingLayer Whether to include the drawing layer in the captured image (default: true)
 * @returns A base64 string representation of the image
 */
export const captureDrawingImage = (
  pdfCanvas: HTMLCanvasElement | null,
  drawingCanvas: HTMLCanvasElement | null,
  boundingBox: { left: number; top: number; width: number; height: number },
  captureDrawingLayer: boolean = true,
): string => {
  if (!pdfCanvas || (!drawingCanvas && captureDrawingLayer)) {
    return '';
  }

  const { left, top, width, height } = boundingBox;

  // Create a new canvas to combine PDF and drawing
  const doc = pdfCanvas.ownerDocument;
  const newCanvas = doc && doc.createElement('canvas');

  if (!newCanvas) {
    return '';
  }

  newCanvas.width = width;
  newCanvas.height = height;

  const newCanvasContext = newCanvas.getContext('2d');

  if (!newCanvasContext) {
    return '';
  }

  const dpr = window.devicePixelRatio;

  // Draw PDF portion first
  try {
    newCanvasContext.drawImage(pdfCanvas, left * dpr, top * dpr, width * dpr, height * dpr, 0, 0, width, height);
  } catch (_error) {
    // Silent fail
  }

  // Draw drawing on top only if captureDrawingLayer is true
  if (captureDrawingLayer && drawingCanvas) {
    // Calculate drawing canvas scale factor relative to PDF canvas
    const scaleFactorX = drawingCanvas.width / pdfCanvas.width;
    const scaleFactorY = drawingCanvas.height / pdfCanvas.height;

    try {
      newCanvasContext.drawImage(
        drawingCanvas,
        left * dpr * scaleFactorX,
        top * dpr * scaleFactorY,
        width * dpr * scaleFactorX,
        height * dpr * scaleFactorY,
        0,
        0,
        width,
        height,
      );
    } catch (_error) {
      // Silent fail
    }
  }

  // Convert to base64 image
  return newCanvas.toDataURL('image/png');
};
