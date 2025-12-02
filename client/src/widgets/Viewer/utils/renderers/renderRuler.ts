import { transformCoordinates, normalizeCoordinatesToZeroRotation } from '../rotationUtils';
import { PointOfInterest } from '../../hooks/useSnapPoints';

interface Ruler {
  id: number;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  distance: number;
  angle: number;
  color: string;
}

interface PreviewRuler {
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
}

// Helper function to convert color string to rgba with opacity
export const colorToRgba = (color: string, opacity: number = 0.95): string => {
  // If already rgba, extract rgb values and apply new opacity
  if (color.startsWith('rgba')) {
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }
  // If rgb, extract values and add opacity
  if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return `rgba(${match[1]}, ${match[2]}, ${match[3]}, ${opacity})`;
    }
  }
  // If hex color
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = Number.parseInt(hex.slice(0, 2), 16);
    const g = Number.parseInt(hex.slice(2, 4), 16);
    const b = Number.parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  // Fallback: return color as-is (might be a named color)
  return color;
};

interface RenderRulerOptions {
  rulers: Ruler[];
  previewRuler?: PreviewRuler | null;
  previewColor?: string;
  drawingLineWidth: number;
  enableSnapPoints?: boolean;
  pointsOfInterest?: PointOfInterest[];
  highlightedPointIndex?: number | null;
  snapTarget?: { index: number; distance: number } | null;
  maxVisibleSnapPoints?: number;
}

/**
 * Renders rulers on the canvas
 */
export const renderRuler = (
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
  options: RenderRulerOptions,
): void => {
  const {
    rulers,
    previewRuler,
    previewColor,
    drawingLineWidth,
    enableSnapPoints = false,
    pointsOfInterest = [],
    highlightedPointIndex = null,
    snapTarget = null,
    maxVisibleSnapPoints = 5,
  } = options;

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

    ctx.beginPath();
    ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
    ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
    ctx.strokeStyle = ruler.color; // Use the ruler's stored color
    ctx.lineWidth = drawingLineWidth;
    ctx.stroke();

    // Draw markers at endpoints - use fixed size instead of scale-dependent size
    const markerSize = 12; // Increased from 10 to 12 for better visibility
    const innerSize = 5; // Increased from 4 to 5 for better visibility
    const markerColor = colorToRgba(ruler.color, 0.95); // Convert ruler color to rgba with opacity

    // Draw start point marker with white center and colored ring
    // First draw the outer colored circle
    ctx.beginPath();
    ctx.arc(transformedStartPoint.x, transformedStartPoint.y, markerSize, 0, 2 * Math.PI);
    ctx.fillStyle = markerColor; // Use ruler's color
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white stroke
    ctx.lineWidth = 2; // Increased stroke width
    ctx.stroke();

    // Then draw the inner white circle
    ctx.beginPath();
    ctx.arc(transformedStartPoint.x, transformedStartPoint.y, innerSize, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();

    // Draw end point marker with white center and colored ring
    // First draw the outer colored circle
    ctx.beginPath();
    ctx.arc(transformedEndPoint.x, transformedEndPoint.y, markerSize, 0, 2 * Math.PI);
    ctx.fillStyle = markerColor; // Use ruler's color
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white stroke
    ctx.lineWidth = 2; // Increased stroke width
    ctx.stroke();

    // Then draw the inner white circle
    ctx.beginPath();
    ctx.arc(transformedEndPoint.x, transformedEndPoint.y, innerSize, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
  });

  // Draw the current ruler being created if applicable
  if (previewRuler && previewColor) {
    ctx.beginPath();
    ctx.setLineDash([5, 3]); // Dashed line for in-progress ruler

    // For the preview during drawing, we need to make the drawing match the
    // final position the ruler will appear in. First, we need to get screen coordinates
    // and then transform them.

    // Create transformation consistent with where the ruler will be when finalized
    // Instead of dividing by scale, we use the coordinates directly since the ruler preview
    // should match where the ruler will appear when released.
    const normalizedStartPoint = normalizeCoordinatesToZeroRotation(
      previewRuler.startPoint,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    const normalizedEndPoint = normalizeCoordinatesToZeroRotation(
      previewRuler.endPoint,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    // Then transform them back to get the correct preview position
    const transformedStartPoint = transformCoordinates(
      normalizedStartPoint.x,
      normalizedStartPoint.y,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    const transformedEndPoint = transformCoordinates(
      normalizedEndPoint.x,
      normalizedEndPoint.y,
      canvasWidth,
      canvasHeight,
      scale,
      rotation,
    );

    ctx.moveTo(transformedStartPoint.x, transformedStartPoint.y);
    ctx.lineTo(transformedEndPoint.x, transformedEndPoint.y);
    ctx.strokeStyle = colorToRgba(previewColor, 0.9); // Use current drawing color for preview
    ctx.lineWidth = drawingLineWidth;
    ctx.stroke();
    ctx.setLineDash([]); // Reset to solid line

    // Draw markers at endpoints - use fixed size instead of scale-dependent size
    const markerSize = 12; // Increased from 10 to 12 for better visibility
    const innerSize = 5; // Increased from 4 to 5 for better visibility
    const previewMarkerColor = colorToRgba(previewColor, 0.95); // Use current drawing color for preview

    // Draw start point marker with white center and colored ring
    // First draw the outer colored circle
    ctx.beginPath();
    ctx.arc(transformedStartPoint.x, transformedStartPoint.y, markerSize, 0, 2 * Math.PI);
    ctx.fillStyle = previewMarkerColor; // Use current drawing color
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white stroke
    ctx.lineWidth = 2; // Increased stroke width
    ctx.stroke();

    // Then draw the inner white circle
    ctx.beginPath();
    ctx.arc(transformedStartPoint.x, transformedStartPoint.y, innerSize, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();

    // Draw end point marker with white center and colored ring
    // First draw the outer colored circle
    ctx.beginPath();
    ctx.arc(transformedEndPoint.x, transformedEndPoint.y, markerSize, 0, 2 * Math.PI);
    ctx.fillStyle = previewMarkerColor; // Use current drawing color
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white stroke
    ctx.lineWidth = 2; // Increased stroke width
    ctx.stroke();

    // Then draw the inner white circle
    ctx.beginPath();
    ctx.arc(transformedEndPoint.x, transformedEndPoint.y, innerSize, 0, 2 * Math.PI);
    ctx.fillStyle = 'white';
    ctx.fill();
  }

  // Draw snap points only if enabled
  if (enableSnapPoints && pointsOfInterest.length > 0) {
    // Limit visible points to maxVisibleSnapPoints
    const visiblePoints = pointsOfInterest
      .sort((a, b) => {
        // Prioritize snap targets and highlighted points
        const aIsSnap = snapTarget && snapTarget.index === pointsOfInterest.indexOf(a);
        const bIsSnap = snapTarget && snapTarget.index === pointsOfInterest.indexOf(b);
        const aIsHighlighted = highlightedPointIndex === pointsOfInterest.indexOf(a);
        const bIsHighlighted = highlightedPointIndex === pointsOfInterest.indexOf(b);

        if (aIsSnap && !bIsSnap) return -1;
        if (!aIsSnap && bIsSnap) return 1;
        if (aIsHighlighted && !bIsHighlighted) return -1;
        if (!aIsHighlighted && bIsHighlighted) return 1;

        // Prioritize corners and intersections over line-ends
        if (a.type !== 'line-end' && b.type === 'line-end') return -1;
        if (a.type === 'line-end' && b.type !== 'line-end') return 1;

        // For the same type, prioritize corners over intersections
        if (a.type === 'corner' && b.type === 'intersection') return -1;
        if (a.type === 'intersection' && b.type === 'corner') return 1;

        // Then sort by confidence
        return b.confidence - a.confidence;
      })
      .slice(0, maxVisibleSnapPoints);

    // Draw all points first - to ensure the green one is on top
    visiblePoints.forEach((point) => {
      const index = pointsOfInterest.indexOf(point);
      const isHighlighted = index === highlightedPointIndex;
      const isSnap = snapTarget && snapTarget.index === index;

      // Skip the nearest point in this pass
      if (isSnap || isHighlighted) return;

      // Draw regular points - make them more visible with larger size
      ctx.beginPath();
      ctx.arc(point.x, point.y, 8, 0, 2 * Math.PI); // Increased from 6 to 8
      ctx.fillStyle = 'rgba(0, 180, 255, 0.8)'; // Brighter blue with higher opacity
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'; // More visible white outline
      ctx.fill();
      ctx.lineWidth = 2; // Thicker outline
      ctx.stroke();
    });

    // Now draw the nearest point (highlighted/snap) on top with larger size and green color
    visiblePoints.forEach((point) => {
      const index = pointsOfInterest.indexOf(point);
      const isHighlighted = index === highlightedPointIndex;
      const isSnap = snapTarget && snapTarget.index === index;

      // Only draw the highlighted/snap point in this pass
      if (!isSnap && !isHighlighted) return;

      // Draw highlighted point bigger and greener for better visibility
      ctx.beginPath();
      ctx.arc(point.x, point.y, 12, 0, 2 * Math.PI); // Increased from 10 to 12
      ctx.fillStyle = isSnap ? 'rgba(0, 220, 0, 0.95)' : 'rgba(255, 165, 0, 0.95)'; // Green for snap, orange for highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // Solid white outline
      ctx.fill();
      ctx.lineWidth = 3; // Thicker outline for better visibility
      ctx.stroke();
    });
  }
};
