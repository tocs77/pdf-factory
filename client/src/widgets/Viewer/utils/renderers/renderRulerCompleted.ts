import { transformCoordinates } from '../rotationUtils';
import { CalibrationSettings } from '../../model/types/viewerSchema';

interface Ruler {
  id: number;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  distance: number;
  angle: number;
  color: string;
}

interface RenderRulerCompletedOptions {
  rulers: Ruler[];
  drawingLineWidth: number;
  calibration: CalibrationSettings;
}

// Function to format distance using calibration
const formatDistance = (pixelDistance: number, calibration: CalibrationSettings): string => {
  // Determine if default calibration (no calibration) is being used
  const isDefaultCalibration = calibration.pixelsPerUnit === 1 && calibration.unitName === 'px';

  if (isDefaultCalibration) {
    return `${Math.round(pixelDistance)} px`;
  }

  // Convert pixel distance to calibrated units
  const calibratedDistance = pixelDistance / calibration.pixelsPerUnit;
  return `${calibratedDistance.toFixed(1)} ${calibration.unitName}`;
};

/**
 * Renders completed rulers on the canvas with short lines at endpoints and distance labels
 */
export const renderRulerCompleted = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
  options: RenderRulerCompletedOptions,
): void => {
  const { rulers, drawingLineWidth, calibration } = options;

  // Draw all existing rulers
  rulers.forEach((ruler) => {
    // Transform points based on current scale and rotation
    const transformedStartPoint = transformCoordinates(
      ruler.startPoint.x,
      ruler.startPoint.y,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    const transformedEndPoint = transformCoordinates(
      ruler.endPoint.x,
      ruler.endPoint.y,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    // Draw the main ruler line
    ctx.beginPath();
    ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
    ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
    ctx.strokeStyle = ruler.color;
    ctx.lineWidth = drawingLineWidth;
    ctx.stroke();

    // Calculate the angle of the ruler line in radians
    const dx = transformedEndPoint.x - transformedStartPoint.x;
    const dy = transformedEndPoint.y - transformedStartPoint.y;
    const lineAngle = Math.atan2(dy, dx);

    // Length of the short lines at endpoints (perpendicular to the ruler line)
    const shortLineLength = 12;

    // Calculate perpendicular angle (90 degrees to the ruler line)
    const perpendicularAngle = lineAngle + Math.PI / 2;

    // Calculate the endpoints of the short lines
    const shortLineOffset = shortLineLength / 2;

    // Draw short line at start point (perpendicular to the ruler line)
    ctx.beginPath();
    ctx.moveTo(
      transformedStartPoint.x - Math.cos(perpendicularAngle) * shortLineOffset,
      transformedStartPoint.y - Math.sin(perpendicularAngle) * shortLineOffset,
    );
    ctx.lineTo(
      transformedStartPoint.x + Math.cos(perpendicularAngle) * shortLineOffset,
      transformedStartPoint.y + Math.sin(perpendicularAngle) * shortLineOffset,
    );
    ctx.strokeStyle = ruler.color;
    ctx.lineWidth = drawingLineWidth;
    ctx.stroke();

    // Draw short line at end point (perpendicular to the ruler line)
    ctx.beginPath();
    ctx.moveTo(
      transformedEndPoint.x - Math.cos(perpendicularAngle) * shortLineOffset,
      transformedEndPoint.y - Math.sin(perpendicularAngle) * shortLineOffset,
    );
    ctx.lineTo(
      transformedEndPoint.x + Math.cos(perpendicularAngle) * shortLineOffset,
      transformedEndPoint.y + Math.sin(perpendicularAngle) * shortLineOffset,
    );
    ctx.strokeStyle = ruler.color;
    ctx.lineWidth = drawingLineWidth;
    ctx.stroke();

    // Draw distance label
    const midPointX = (transformedStartPoint.x + transformedEndPoint.x) / 2;
    const midPointY = (transformedStartPoint.y + transformedEndPoint.y) / 2;

    // Calculate text angle for readability (ensure text is not upside down)
    let textAngle = lineAngle * (180 / Math.PI);
    if (textAngle > 90 || textAngle < -90) {
      textAngle += 180;
    }

    // Calculate offset to position text above the line
    const offsetX = Math.sin(lineAngle) * 15;
    const offsetY = -Math.cos(lineAngle) * 15;

    const labelX = midPointX + offsetX;
    const labelY = midPointY + offsetY;

    // Format the distance text
    const distanceText = formatDistance(ruler.distance, calibration);

    // Save canvas state
    ctx.save();

    // Set text style to measure text before rotation
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Measure text to get dimensions for background
    const textMetrics = ctx.measureText(distanceText);
    const textWidth = textMetrics.width;
    const textHeight = 20; // Approximate height
    const padding = 6;

    // Translate to label position and rotate
    ctx.translate(labelX, labelY);
    ctx.rotate((textAngle * Math.PI) / 180);

    // Draw text background (centered at origin after translation/rotation)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(-textWidth / 2 - padding, -textHeight / 2 - padding / 2, textWidth + padding * 2, textHeight + padding);

    // Draw border (centered at origin after translation/rotation)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(-textWidth / 2 - padding, -textHeight / 2 - padding / 2, textWidth + padding * 2, textHeight + padding);

    // Draw text (centered at origin after translation/rotation)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillText(distanceText, 0, 0);

    // Restore canvas state
    ctx.restore();
  });
};
