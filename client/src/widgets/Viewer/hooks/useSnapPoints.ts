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
  direction?: number; // For line endpoints, the direction of the line
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

// Improved edge detection using Sobel operators
const calculateSobelGradients = (data: Uint8ClampedArray, width: number, height: number, x: number, y: number) => {
  if (x < 1 || x >= width - 1 || y < 1 || y >= height - 1) {
    return { gx: 0, gy: 0, magnitude: 0, direction: 0 };
  }

  // Sobel X kernel: [-1, 0, 1; -2, 0, 2; -1, 0, 1]
  // Sobel Y kernel: [-1, -2, -1; 0, 0, 0; 1, 2, 1]

  const getGrayscale = (px: number, py: number) => {
    const idx = (py * width + px) * 4;
    return (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
  };

  const gx =
    -getGrayscale(x - 1, y - 1) +
    getGrayscale(x + 1, y - 1) +
    -2 * getGrayscale(x - 1, y) +
    2 * getGrayscale(x + 1, y) +
    -getGrayscale(x - 1, y + 1) +
    getGrayscale(x + 1, y + 1);

  const gy =
    -getGrayscale(x - 1, y - 1) -
    2 * getGrayscale(x, y - 1) -
    getGrayscale(x + 1, y - 1) +
    getGrayscale(x - 1, y + 1) +
    2 * getGrayscale(x, y + 1) +
    getGrayscale(x + 1, y + 1);

  const magnitude = Math.sqrt(gx * gx + gy * gy);
  const direction = Math.atan2(gy, gx);

  return { gx, gy, magnitude, direction };
};

// Calculate adaptive threshold based on local image statistics
const calculateAdaptiveThreshold = (data: Uint8ClampedArray, width: number, height: number) => {
  let sum = 0;
  let sumSquares = 0;
  let count = 0;

  // Sample pixels to calculate mean and standard deviation
  const step = 3; // Sample every 3rd pixel for performance
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = (y * width + x) * 4;
      const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      sum += gray;
      sumSquares += gray * gray;
      count++;
    }
  }

  const mean = sum / count;
  const variance = sumSquares / count - mean * mean;
  const stdDev = Math.sqrt(variance);

  // Adaptive threshold based on local statistics
  // Higher threshold for high-contrast areas, lower for low-contrast
  const baseThreshold = Math.max(20, Math.min(80, mean * 0.3 + stdDev * 0.5));
  return baseThreshold;
};

// Detect line structures and their endpoints
const detectLineEndpoints = (
  gradients: Array<{ x: number; y: number; magnitude: number; direction: number }>,
  threshold: number,
) => {
  const lineEndpoints: PointOfInterest[] = [];

  // Group gradients by similar direction to find line segments
  const directionGroups: { [key: number]: Array<{ x: number; y: number; magnitude: number; direction: number }> } = {};

  gradients.forEach((grad) => {
    if (grad.magnitude < threshold) return;

    // Quantize direction to 8 main directions (0, 45, 90, 135, 180, 225, 270, 315 degrees)
    const quantizedDir = Math.round(grad.direction / (Math.PI / 4)) * (Math.PI / 4);
    const dirKey = Math.round(quantizedDir * 100); // Use rounded value as key

    if (!directionGroups[dirKey]) {
      directionGroups[dirKey] = [];
    }
    directionGroups[dirKey].push(grad);
  });

  // For each direction group, find potential endpoints
  Object.values(directionGroups).forEach((group) => {
    if (group.length < 3) return; // Need at least 3 points to form a meaningful line

    // Sort by position along the line direction
    const direction = group[0].direction;
    group.sort((a, b) => {
      const aProjection = a.x * Math.cos(direction) + a.y * Math.sin(direction);
      const bProjection = b.x * Math.cos(direction) + b.y * Math.sin(direction);
      return aProjection - bProjection;
    });

    // Check first and last points as potential endpoints
    const first = group[0];
    const last = group[group.length - 1];

    // Verify they're actually endpoints by checking if they have fewer neighbors
    const countNeighbors = (point: { x: number; y: number }) => {
      return group.filter((p) => Math.sqrt((p.x - point.x) ** 2 + (p.y - point.y) ** 2) < 5).length;
    };

    if (countNeighbors(first) <= 2) {
      lineEndpoints.push({
        x: first.x,
        y: first.y,
        type: 'line-end',
        confidence: first.magnitude,
        direction: direction,
      });
    }

    if (countNeighbors(last) <= 2) {
      lineEndpoints.push({
        x: last.x,
        y: last.y,
        type: 'line-end',
        confidence: last.magnitude,
        direction: direction,
      });
    }
  });

  return lineEndpoints;
};

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

  // Blueprint-focused image analysis - only line endpoints, corners, and intersections
  const analyzeImageData = useCallback(
    (imageData: ImageData, offsetX: number, offsetY: number): PointOfInterest[] => {
      const { data, width, height } = imageData;

      // Check if the area is blank/empty
      const isBlankArea = (() => {
        let totalSamples = 0;
        let blankSamples = 0;
        const sampleStep = 6; // Larger step for faster blank detection

        for (let y = 0; y < height; y += sampleStep) {
          for (let x = 0; x < width; x += sampleStep) {
            const idx = (y * width + x) * 4;
            const r = data[idx];
            const g = data[idx + 1];
            const b = data[idx + 2];

            const isBlankPixel = r > 230 && g > 230 && b > 230;
            totalSamples++;
            if (isBlankPixel) blankSamples++;
          }
        }

        return blankSamples / totalSamples > 0.9;
      })();

      if (isBlankArea) return [];

      // Calculate adaptive threshold with higher baseline for blueprints
      const adaptiveThreshold = calculateAdaptiveThreshold(data, width, height);
      const blueprintThreshold = Math.max(adaptiveThreshold, 50); // Higher minimum threshold for blueprints

      // Collect only strong edges for blueprint detection
      const gradients: Array<{ x: number; y: number; magnitude: number; direction: number }> = [];

      // Use step of 2 for better performance while maintaining accuracy for blueprints
      const scanStep = 2;

      for (let y = scanStep; y < height - scanStep; y += scanStep) {
        for (let x = scanStep; x < width - scanStep; x += scanStep) {
          const sobel = calculateSobelGradients(data, width, height, x, y);

          // Only consider strong edges for blueprints
          if (sobel.magnitude > blueprintThreshold) {
            gradients.push({
              x: offsetX + x,
              y: offsetY + y,
              magnitude: sobel.magnitude,
              direction: sobel.direction,
            });
          }
        }
      }

      if (gradients.length < 15) return []; // Need sufficient edge data for meaningful detection

      const points: PointOfInterest[] = [];

      // 1. Detect line endpoints - most important for blueprints
      const endpoints = detectLineEndpoints(gradients, blueprintThreshold);

      // Filter endpoints to avoid points on straight lines
      const filteredEndpoints = endpoints.filter((endpoint) => {
        // Check if this point has too many neighbors in the same direction (indicating it's on a line)
        const sameDirectionNeighbors = gradients.filter((g) => {
          const distance = Math.sqrt((g.x - endpoint.x) ** 2 + (g.y - endpoint.y) ** 2);
          if (distance > 15 || distance < 3) return false;

          const directionDiff = Math.abs(g.direction - (endpoint.direction || 0));
          const normalizedDiff = Math.min(directionDiff, 2 * Math.PI - directionDiff);
          return normalizedDiff < Math.PI / 8; // Within 22.5 degrees
        });

        // If there are too many neighbors in the same direction, it's likely on a line
        return sameDirectionNeighbors.length <= 3;
      });

      points.push(...filteredEndpoints);

      // 2. Detect corners and intersections - focus on significant direction changes
      gradients.forEach((grad) => {
        const { x, y, magnitude } = grad;

        if (magnitude < blueprintThreshold * 1.3) return; // Higher threshold for corners

        // Find nearby gradients with significant magnitude
        const nearby = gradients.filter(
          (g) => Math.sqrt((g.x - x) ** 2 + (g.y - y) ** 2) <= 12 && g !== grad && g.magnitude > blueprintThreshold * 0.8,
        );

        if (nearby.length < 4) return; // Need sufficient neighbors

        // Group directions into clusters to detect intersections/corners
        const directionClusters: number[][] = [];
        nearby.forEach((neighbor) => {
          let addedToCluster = false;
          for (const cluster of directionClusters) {
            const avgClusterDir = cluster.reduce((sum, d) => sum + d, 0) / cluster.length;
            const diff = Math.abs(neighbor.direction - avgClusterDir);
            const normalizedDiff = Math.min(diff, 2 * Math.PI - diff);

            if (normalizedDiff < Math.PI / 6) {
              // Within 30 degrees
              cluster.push(neighbor.direction);
              addedToCluster = true;
              break;
            }
          }

          if (!addedToCluster) {
            directionClusters.push([neighbor.direction]);
          }
        });

        // Filter out small clusters
        const significantClusters = directionClusters.filter((cluster) => cluster.length >= 3);

        if (significantClusters.length >= 2) {
          // Calculate angle between main directions
          const dir1 = significantClusters[0].reduce((sum, d) => sum + d, 0) / significantClusters[0].length;
          const dir2 = significantClusters[1].reduce((sum, d) => sum + d, 0) / significantClusters[1].length;

          let angleBetween = Math.abs(dir1 - dir2);
          if (angleBetween > Math.PI) angleBetween = 2 * Math.PI - angleBetween;

          // Only consider significant angle changes (not shallow curves)
          if (angleBetween > Math.PI / 4) {
            // More than 45 degrees for blueprints
            const confidence = magnitude * (1 + angleBetween / Math.PI) * 1.5; // Higher confidence for blueprints

            if (significantClusters.length >= 3) {
              points.push({
                x,
                y,
                type: 'intersection',
                confidence: confidence * 1.3, // Highest priority for intersections
              });
            } else {
              points.push({
                x,
                y,
                type: 'corner',
                confidence,
              });
            }
          }
        }
      });

      // Filter out redundant points with blueprint-specific filtering
      const filteredPoints: PointOfInterest[] = [];

      // Sort by type priority and confidence
      const sortedPoints = points.sort((a, b) => {
        const typeWeight = { intersection: 3, corner: 2, 'line-end': 1 };
        const aWeight = (typeWeight[a.type] || 0) * 100 + a.confidence;
        const bWeight = (typeWeight[b.type] || 0) * 100 + b.confidence;
        return bWeight - aWeight;
      });

      for (const point of sortedPoints) {
        const isDuplicate = filteredPoints.some((existing) => {
          const distance = Math.sqrt((existing.x - point.x) ** 2 + (existing.y - point.y) ** 2);
          return distance < Math.max(snapMinDistance, 10); // Minimum 10px separation for blueprints
        });

        if (!isDuplicate) {
          filteredPoints.push(point);
        }

        // Limit to max visible points
        if (filteredPoints.length >= maxVisibleSnapPoints) break;
      }

      return filteredPoints;
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

  // Enhanced nearby point checking with priority scoring
  const throttledCheckNearbyPoints = useCallback(
    throttle((x: number, y: number) => {
      if (pointsOfInterest.length === 0) {
        setHighlightedPointIndex(null);
        setSnapTarget(null);
        return;
      }

      // Calculate priority score for each point
      const scoredPoints = pointsOfInterest.map((point, index) => {
        const distance = Math.sqrt(Math.pow(point.x - x, 2) + Math.pow(point.y - y, 2));

        // Priority scoring: closer distance + higher confidence + type preference
        const typeBonus =
          {
            intersection: 1.3,
            corner: 1.2,
            'line-end': 1.0,
          }[point.type] || 1.0;

        // Inverse distance scoring (closer = higher score)
        const distanceScore = 100 / (distance + 1);
        const confidenceScore = point.confidence / 100;

        const totalScore = distanceScore * confidenceScore * typeBonus;

        return { index, distance, score: totalScore, point };
      });

      // Sort by score and find the best point
      scoredPoints.sort((a, b) => b.score - a.score);
      const bestPoint = scoredPoints[0];

      setHighlightedPointIndex(bestPoint.index);

      // Set snap target if within reasonable distance (smaller for blueprint precision)
      const MAX_SNAP_DISTANCE = 35; // Smaller distance for blueprints (more precise)
      if (bestPoint.distance <= MAX_SNAP_DISTANCE) {
        setSnapTarget({
          index: bestPoint.index,
          distance: bestPoint.distance,
        });
      } else {
        setSnapTarget(null);
      }

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
        const roundedX = Math.round(x);
        const roundedY = Math.round(y);

        // Smaller radius for blueprint precision
        const detectionRadius = Math.min(snapDetectionRadius, 30); // Smaller radius for blueprints

        const imageData = ctx.getImageData(
          Math.max(0, roundedX - detectionRadius),
          Math.max(0, roundedY - detectionRadius),
          detectionRadius * 2,
          detectionRadius * 2,
        );

        const points = analyzeImageData(imageData, roundedX - detectionRadius, roundedY - detectionRadius);
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
      if (!hasMovedEnoughToUpdate(x, y)) return;

      const points = findPointsOfInterest(x, y);
      setPointsOfInterest(points);

      if (points.length > 0) {
        throttledCheckNearbyPoints(x, y);
      } else {
        lastUpdatePositionRef.current = { x, y };
        setHighlightedPointIndex(null);
        setSnapTarget(null);
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
