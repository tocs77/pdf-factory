/**
 * Utility functions for handling rotations in the viewer
 */

/**
 * Rotates a point around a center point by a given angle
 * @param x0 X coordinate of the point to rotate
 * @param y0 Y coordinate of the point to rotate
 * @param xc X coordinate of the center point
 * @param yc Y coordinate of the center point
 * @param theta Angle in degrees
 * @returns Rotated point coordinates
 */
export const rotatePoint = (x0: number, y0: number, xc: number, yc: number, theta: number): { x: number; y: number } => {
  const radians = (theta * Math.PI) / 180;
  const x1 = xc + (x0 - xc) * Math.cos(radians) - (y0 - yc) * Math.sin(radians);
  const y1 = yc + (x0 - xc) * Math.sin(radians) + (y0 - yc) * Math.cos(radians);
  return { x: x1, y: y1 };
};

/**
 * Transforms coordinates from scale 1 and rotation 0 to current scale and rotation
 * @param x X coordinate at scale 1 and rotation 0
 * @param y Y coordinate at scale 1 and rotation 0
 * @param canvasWidth Width of the canvas
 * @param canvasHeight Height of the canvas
 * @param scale Current scale factor
 * @param rotation Current rotation angle in degrees
 * @returns Transformed coordinates
 */
export const transformCoordinates = (
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): { x: number; y: number } => {
  // First scale the coordinates
  const scaledX = x * scale;
  const scaledY = y * scale;

  // Apply rotation based on the angle
  let xPrime: number;
  let yPrime: number;

  switch (rotation) {
    case 90:
      xPrime = canvasWidth - scaledY;
      yPrime = scaledX;
      break;
    case 180:
      xPrime = canvasWidth - scaledX;
      yPrime = canvasHeight - scaledY;
      break;
    case 270:
      xPrime = scaledY;
      yPrime = canvasHeight - scaledX;
      break;
    case 0:
    default:
      xPrime = scaledX;
      yPrime = scaledY;
      break;
  }

  return { x: xPrime, y: yPrime };
};

/**
 * Transforms coordinates from current rotation and scale to normalized (scale 1, rotation 0)
 * @param point Point coordinates at current scale and rotation
 * @param canvasWidth Width of the canvas
 * @param canvasHeight Height of the canvas
 * @param scale Current scale factor
 * @param rotation Current rotation angle in degrees
 * @returns Normalized coordinates at scale 1 and rotation 0
 */
export const normalizeCoordinatesToZeroRotation = (
  point: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number,
  scale: number,
  rotation: number,
): { x: number; y: number } => {
  let xPrime: number;
  let yPrime: number;

  // Adjust coordinates based on rotation from top-left corner
  switch (rotation) {
    case 90:
      xPrime = point.y;
      yPrime = canvasWidth - point.x;
      break;
    case 180:
      xPrime = canvasWidth - point.x;
      yPrime = canvasHeight - point.y;
      break;
    case 270:
      xPrime = canvasHeight - point.y;
      yPrime = point.x;
      break;
    case 0:
    default:
      xPrime = point.x;
      yPrime = point.y;
      break;
  }

  // Scale back to original coordinates
  const x = xPrime / scale;
  const y = yPrime / scale;

  return { x, y };
};
