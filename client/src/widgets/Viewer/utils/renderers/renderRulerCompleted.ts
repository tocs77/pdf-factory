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

// Constants for arrow rendering
const MAX_ARROW_HEAD_LENGTH = 15; // Maximum length of the arrow head
const ARROW_HEAD_WIDTH_FACTOR = 0.4; // Relative width of arrowhead base to length

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
 * Draws an arrow at a point along a given direction
 * @param ctx Canvas rendering context
 * @param tipX X coordinate of the arrow tip
 * @param tipY Y coordinate of the arrow tip
 * @param directionAngle Angle in radians indicating the direction the arrow points
 * @param color Color of the arrow
 * @param lineWidth Line width for the arrow
 */
const drawArrow = (
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  directionAngle: number,
  color: string,
  lineWidth: number,
): void => {
  // Use a fixed minimum arrow head length for visibility (similar to extension lines)
  // The arrow head should be visible regardless of line width
  const arrowHeadLength = Math.max(8, Math.min(MAX_ARROW_HEAD_LENGTH, lineWidth * 4));
  const arrowHeadWidth = arrowHeadLength * ARROW_HEAD_WIDTH_FACTOR;

  // Calculate the arrow base point (point where the arrowhead starts)
  const arrowBaseX = tipX - Math.cos(directionAngle) * arrowHeadLength;
  const arrowBaseY = tipY - Math.sin(directionAngle) * arrowHeadLength;

  // Save context for shadow
  ctx.save();

  // Add shadow for depth
  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 3;
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;

  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Draw the open arrowhead (V shape, not filled) - no shaft needed
  ctx.beginPath();
  ctx.moveTo(tipX, tipY); // Tip of the arrow

  // Calculate the perpendicular vector for arrowhead width
  const perpX = -Math.sin(directionAngle);
  const perpY = Math.cos(directionAngle);

  // Calculate the two base points of the arrowhead
  const baseX1 = arrowBaseX + perpX * arrowHeadWidth;
  const baseY1 = arrowBaseY + perpY * arrowHeadWidth;
  const baseX2 = arrowBaseX - perpX * arrowHeadWidth;
  const baseY2 = arrowBaseY - perpY * arrowHeadWidth;

  // Draw the V shape (open arrowhead)
  ctx.lineTo(baseX1, baseY1);
  ctx.moveTo(tipX, tipY); // Move back to tip
  ctx.lineTo(baseX2, baseY2);

  ctx.stroke(); // Stroke the arrowhead (open, not filled)

  // Restore context (remove shadow)
  ctx.restore();
};

/**
 * Renders completed rulers on the canvas with arrows at endpoints and distance labels
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

    // Calculate the angle of the ruler line in radians
    const dx = transformedEndPoint.x - transformedStartPoint.x;
    const dy = transformedEndPoint.y - transformedStartPoint.y;
    const lineAngle = Math.atan2(dy, dx);

    // Draw the main ruler line (full length from start to end)
    ctx.beginPath();
    ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
    ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
    ctx.strokeStyle = ruler.color;
    ctx.lineWidth = drawingLineWidth;
    ctx.stroke();

    // Draw arrow at start point pointing outward (away from center, 180 degrees from line direction)
    drawArrow(ctx, transformedStartPoint.x, transformedStartPoint.y, lineAngle + Math.PI, ruler.color, drawingLineWidth);

    // Draw arrow at end point pointing outward (away from center, same as line direction)
    drawArrow(ctx, transformedEndPoint.x, transformedEndPoint.y, lineAngle, ruler.color, drawingLineWidth);

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

    // Set text style
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Translate to label position and rotate
    ctx.translate(labelX, labelY);
    ctx.rotate((textAngle * Math.PI) / 180);

    // Draw text (centered at origin after translation/rotation)
    ctx.fillStyle = ruler.color;
    ctx.fillText(distanceText, 0, 0);

    // Restore canvas state
    ctx.restore();
  });
};
