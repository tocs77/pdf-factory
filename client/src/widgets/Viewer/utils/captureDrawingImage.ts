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

  // Bounding box is already in actual pixel coordinates (not CSS pixels)
  // So we use it directly without multiplying by devicePixelRatio
  newCanvas.width = width;
  newCanvas.height = height;

  const newCanvasContext = newCanvas.getContext('2d');

  if (!newCanvasContext) {
    return '';
  }

  // Draw PDF portion first
  // left, top, width, height are already in actual pixel coordinates
  try {
    newCanvasContext.drawImage(pdfCanvas, left, top, width, height, 0, 0, width, height);
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
        left * scaleFactorX,
        top * scaleFactorY,
        width * scaleFactorX,
        height * scaleFactorY,
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
