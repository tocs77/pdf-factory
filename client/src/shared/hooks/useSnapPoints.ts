import { useState, useCallback, useRef } from 'react';

// Throttle utility function
const throttle = (fn: Function, delay: number) => {
  let lastCall = 0;
  return function (...args: any[]) {
    const now = Date.now();
    if (now - lastCall < delay) return;
    lastCall = now;
    return fn(...args);
  };
};

export interface PointOfInterest {
  x: number;
  y: number;
  type: 'line-end' | 'corner' | 'intersection';
  confidence: number;
}

export interface UseSnapPointsOptions {
  snapDetectionRadius: number;
  snapMinDistance: number;
  maxVisibleSnapPoints: number;
  snapUpdateDelay: number;
  mouseMovementThreshold: number;
  pdfCanvasRef: React.RefObject<HTMLCanvasElement> | undefined;
}

export interface UseSnapPointsReturn {
  pointsOfInterest: PointOfInterest[];
  highlightedPointIndex: number | null;
  snapTarget: { index: number; distance: number } | null;
  findPointsOfInterest: (x: number, y: number) => PointOfInterest[];
  throttledFindPoints: (x: number, y: number) => void;
  hasMovedEnoughToUpdate: (x: number, y: number) => boolean;
  setPointsOfInterest: React.Dispatch<React.SetStateAction<PointOfInterest[]>>;
  setHighlightedPointIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setSnapTarget: React.Dispatch<React.SetStateAction<{ index: number; distance: number } | null>>;
  lastUpdatePositionRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

export function useSnapPoints({
  snapDetectionRadius,
  snapMinDistance,
  maxVisibleSnapPoints,
  snapUpdateDelay,
  mouseMovementThreshold,
  pdfCanvasRef,
}: UseSnapPointsOptions): UseSnapPointsReturn {
  // State for points of interest and snap targets
  const [pointsOfInterest, setPointsOfInterest] = useState<PointOfInterest[]>([]);
  const [highlightedPointIndex, setHighlightedPointIndex] = useState<number | null>(null);
  const [snapTarget, setSnapTarget] = useState<{ index: number; distance: number } | null>(null);

  // Ref to track the last position where snap points were updated
  const lastUpdatePositionRef = useRef<{ x: number; y: number } | null>(null);

  // Analyze image data to find potential snap points
  const analyzeImageData = useCallback(
    (imageData: ImageData, offsetX: number, offsetY: number): PointOfInterest[] => {
      const { data, width, height } = imageData;
      const points: PointOfInterest[] = [];
      const threshold = 40; // Threshold for edge detection
      const scanStep = 2; // Scan frequency for better detection

      // Check if the area is blank/empty
      const isBlankArea = (() => {
        // Sample the image data to check for blank areas
        let totalSamples = 0;
        let blankSamples = 0;
        const sampleStep = 4; // Sample every 4th pixel to save processing time

        for (let y = 0; y < height; y += sampleStep) {
          for (let x = 0; x < width; x += sampleStep) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            // Consider near-white pixels as blank (allowing for slight variations)
            const isBlankPixel = r > 240 && g > 240 && b > 240;

            totalSamples++;
            if (isBlankPixel) blankSamples++;
          }
        }

        // If more than 95% of the sampled pixels are blank, consider it a blank area
        return blankSamples / totalSamples > 0.95;
      })();

      // If it's a blank area, don't create any snap points
      if (isBlankArea) {
        return [];
      }

      // Advanced detection for corners, intersections and line endpoints
      for (let y = scanStep; y < height - scanStep; y += scanStep) {
        for (let x = scanStep; x < width - scanStep; x += scanStep) {
          // Skip processing for likely blank pixels
          const centerIdx = (y * width + x) * 4;
          const centerRGB = [data[centerIdx], data[centerIdx + 1], data[centerIdx + 2]];
          if (centerRGB[0] > 240 && centerRGB[1] > 240 && centerRGB[2] > 240) continue;

          // Check neighboring pixels in 8 directions
          const topIdx = ((y - scanStep) * width + x) * 4;
          const bottomIdx = ((y + scanStep) * width + x) * 4;
          const leftIdx = (y * width + (x - scanStep)) * 4;
          const rightIdx = (y * width + (x + scanStep)) * 4;
          const topLeftIdx = ((y - scanStep) * width + (x - scanStep)) * 4;
          const topRightIdx = ((y - scanStep) * width + (x + scanStep)) * 4;
          const bottomLeftIdx = ((y + scanStep) * width + (x - scanStep)) * 4;
          const bottomRightIdx = ((y + scanStep) * width + (x + scanStep)) * 4;

          // Get grayscale values for each pixel
          const centerGray = (data[centerIdx] + data[centerIdx + 1] + data[centerIdx + 2]) / 3;
          const topGray = (data[topIdx] + data[topIdx + 1] + data[topIdx + 2]) / 3;
          const bottomGray = (data[bottomIdx] + data[bottomIdx + 1] + data[bottomIdx + 2]) / 3;
          const leftGray = (data[leftIdx] + data[leftIdx + 1] + data[leftIdx + 2]) / 3;
          const rightGray = (data[rightIdx] + data[rightIdx + 1] + data[rightIdx + 2]) / 3;
          const topLeftGray = (data[topLeftIdx] + data[topLeftIdx + 1] + data[topLeftIdx + 2]) / 3;
          const topRightGray = (data[topRightIdx] + data[topRightIdx + 1] + data[topRightIdx + 2]) / 3;
          const bottomLeftGray = (data[bottomLeftIdx] + data[bottomLeftIdx + 1] + data[bottomLeftIdx + 2]) / 3;
          const bottomRightGray = (data[bottomRightIdx] + data[bottomRightIdx + 1] + data[bottomRightIdx + 2]) / 3;

          // Calculate gradients in different directions
          const horizontalDiff = Math.abs(leftGray - rightGray);
          const verticalDiff = Math.abs(topGray - bottomGray);
          const diag1Diff = Math.abs(topLeftGray - bottomRightGray);
          const diag2Diff = Math.abs(topRightGray - bottomLeftGray);

          // Skip if all gradients are very low - indicates uniform area
          if (
            horizontalDiff < threshold / 2 &&
            verticalDiff < threshold / 2 &&
            diag1Diff < threshold / 2 &&
            diag2Diff < threshold / 2
          ) {
            continue;
          }

          // Get differences between surrounding pixels to detect patterns
          const horizontalGradients = [
            Math.abs(topLeftGray - topGray),
            Math.abs(topGray - topRightGray),
            Math.abs(leftGray - centerGray),
            Math.abs(centerGray - rightGray),
            Math.abs(bottomLeftGray - bottomGray),
            Math.abs(bottomGray - bottomRightGray),
          ];

          const verticalGradients = [
            Math.abs(topLeftGray - leftGray),
            Math.abs(leftGray - bottomLeftGray),
            Math.abs(topGray - centerGray),
            Math.abs(centerGray - bottomGray),
            Math.abs(topRightGray - rightGray),
            Math.abs(rightGray - bottomRightGray),
          ];

          // Calculate edge pattern to distinguish between points on lines vs endpoints/corners
          const isOnHorizontalLine =
            horizontalGradients.every((gradient) => gradient < threshold / 2) && verticalDiff > threshold;
          const isOnVerticalLine = verticalGradients.every((gradient) => gradient < threshold / 2) && horizontalDiff > threshold;

          // Define surrounding pixel pattern
          const surroundingPixels = [
            topGray,
            rightGray,
            bottomGray,
            leftGray,
            topLeftGray,
            topRightGray,
            bottomLeftGray,
            bottomRightGray,
          ];

          // Count pixels that significantly differ from center (edge pixels)
          const edgeCount = surroundingPixels.filter((gray) => Math.abs(gray - centerGray) > threshold).length;

          // Detect corners - sharp changes in multiple directions simultaneously
          if (
            (horizontalDiff > threshold && verticalDiff > threshold && !isOnHorizontalLine && !isOnVerticalLine) ||
            (diag1Diff > threshold && diag2Diff > threshold)
          ) {
            points.push({
              x: offsetX + x,
              y: offsetY + y,
              type: 'corner',
              confidence: (horizontalDiff + verticalDiff + diag1Diff + diag2Diff) / 4,
            });
          }
          // Detect intersections - multiple edge directions meeting
          else if (
            edgeCount >= 3 &&
            ((horizontalDiff > threshold && verticalDiff > threshold / 2) ||
              (verticalDiff > threshold && horizontalDiff > threshold / 2)) &&
            !isOnHorizontalLine &&
            !isOnVerticalLine
          ) {
            points.push({
              x: offsetX + x,
              y: offsetY + y,
              type: 'intersection',
              confidence: ((horizontalDiff + verticalDiff) / 2) * (edgeCount / 8),
            });
          }
          // Detect line endpoints - look for abrupt ending pattern
          else if (
            edgeCount <= 2 &&
            // At least one direction needs significant change
            (horizontalDiff > threshold || verticalDiff > threshold || diag1Diff > threshold || diag2Diff > threshold) &&
            // Discard points that are likely on straight lines
            !isOnHorizontalLine &&
            !isOnVerticalLine
          ) {
            // Additional endpoint verification - check for endpoint pattern
            // True endpoints have high intensity change in limited directions
            const isEndpoint =
              // Check for patterns that indicate endpoints rather than points along a line
              (horizontalDiff > threshold * 1.2 &&
                surroundingPixels.filter((p) => Math.abs(p - centerGray) < threshold / 2).length >= 5) ||
              (verticalDiff > threshold * 1.2 &&
                surroundingPixels.filter((p) => Math.abs(p - centerGray) < threshold / 2).length >= 5) ||
              (diag1Diff > threshold * 1.2 &&
                surroundingPixels.filter((p) => Math.abs(p - centerGray) < threshold / 2).length >= 5) ||
              (diag2Diff > threshold * 1.2 &&
                surroundingPixels.filter((p) => Math.abs(p - centerGray) < threshold / 2).length >= 5);

            if (isEndpoint) {
              points.push({
                x: offsetX + x,
                y: offsetY + y,
                type: 'line-end',
                confidence: Math.max(horizontalDiff, verticalDiff, diag1Diff, diag2Diff),
              });
            }
          }
        }
      }

      // Filter out redundant points (points that are very close to each other)
      const filteredPoints: PointOfInterest[] = [];

      for (const point of points) {
        if (!filteredPoints.some((p) => Math.sqrt(Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)) < snapMinDistance)) {
          filteredPoints.push(point);
        }
      }

      // Return the found points, sorted by confidence
      return filteredPoints.sort((a, b) => b.confidence - a.confidence).slice(0, maxVisibleSnapPoints);
    },
    [snapMinDistance, maxVisibleSnapPoints],
  );

  // Check if position has moved far enough to trigger an update
  const hasMovedEnoughToUpdate = useCallback(
    (x: number, y: number): boolean => {
      if (!lastUpdatePositionRef.current) return true;

      const { x: lastX, y: lastY } = lastUpdatePositionRef.current;
      const distMoved = Math.sqrt(Math.pow(x - lastX, 2) + Math.pow(y - lastY, 2));

      return distMoved >= mouseMovementThreshold;
    },
    [mouseMovementThreshold],
  );

  // Find the closest point out of the points of interest
  const throttledCheckNearbyPoints = useCallback(
    throttle((x: number, y: number) => {
      // Always find the closest point regardless of threshold for better usability
      let closestPointIndex = null;
      let minDistance = Infinity; // Use Infinity to always find the closest point

      pointsOfInterest.forEach((point, index) => {
        const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));

        // Find the closest point, period
        if (distance < minDistance) {
          minDistance = distance;
          closestPointIndex = index;
        }
      });

      // Always highlight the closest point if available
      setHighlightedPointIndex(closestPointIndex);

      // Only set snap target if the points array is not empty
      if (closestPointIndex !== null && pointsOfInterest.length > 0) {
        // Only set as snap target if it's within a reasonable distance (50 pixels)
        // This prevents snap points from appearing too far from cursor
        const MAX_SNAP_DISTANCE = 50;
        if (minDistance <= MAX_SNAP_DISTANCE) {
          setSnapTarget({
            index: closestPointIndex,
            distance: minDistance,
          });
        } else {
          setSnapTarget(null);
        }
      } else {
        setSnapTarget(null);
      }

      // Update the last position where snap points were updated
      lastUpdatePositionRef.current = { x, y };
    }, snapUpdateDelay),
    [pointsOfInterest, snapUpdateDelay],
  );

  // Find points of interest in the PDF near a given coordinate
  const findPointsOfInterest = useCallback(
    (x: number, y: number): PointOfInterest[] => {
      if (!pdfCanvasRef?.current) return [];

      const ctx = pdfCanvasRef.current.getContext('2d', { willReadFrequently: true });
      if (!ctx) return [];

      try {
        // Round coordinates to reduce unnecessary recomputation
        const roundedX = Math.round(x);
        const roundedY = Math.round(y);

        // Get the image data around the cursor
        const imageData = ctx.getImageData(
          Math.max(0, roundedX - snapDetectionRadius),
          Math.max(0, roundedY - snapDetectionRadius),
          snapDetectionRadius * 2,
          snapDetectionRadius * 2,
        );

        // Process the image data to find edges, corners, line endpoints
        const points = analyzeImageData(imageData, roundedX - snapDetectionRadius, roundedY - snapDetectionRadius);

        // Return found points
        return points;
      } catch (error) {
        console.error('Error analyzing PDF canvas:', error);
        return [];
      }
    },
    [pdfCanvasRef, snapDetectionRadius, analyzeImageData],
  );

  // Throttled version of findPointsOfInterest
  const throttledFindPoints = useCallback(
    throttle((x: number, y: number) => {
      // Only update if the mouse has moved enough since the last update
      if (!hasMovedEnoughToUpdate(x, y)) return;

      const points = findPointsOfInterest(x, y);
      setPointsOfInterest(points);

      // Check if there are points to snap to
      if (points.length > 0) {
        throttledCheckNearbyPoints(x, y);
      } else {
        // Update the last position even when no points are found
        lastUpdatePositionRef.current = { x, y };
      }
    }, snapUpdateDelay),
    [findPointsOfInterest, throttledCheckNearbyPoints, hasMovedEnoughToUpdate, snapUpdateDelay],
  );

  return {
    pointsOfInterest,
    highlightedPointIndex,
    snapTarget,
    findPointsOfInterest,
    throttledFindPoints,
    hasMovedEnoughToUpdate,
    setPointsOfInterest,
    setHighlightedPointIndex,
    setSnapTarget,
    lastUpdatePositionRef,
  };
}
