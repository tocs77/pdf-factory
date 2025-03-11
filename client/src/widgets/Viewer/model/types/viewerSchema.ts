interface BaseDrawing {
  type: string;
  pageNumber: number;
  id: string;
}

export interface DrawingPath extends BaseDrawing {
  type: 'freehand';
  /**
   * Array of points representing the drawing path.
   * All coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
}

export interface Rectangle extends BaseDrawing {
  type: 'rectangle';
  /**
   * Start point (top-left) of the rectangle
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  startPoint: { x: number; y: number };
  /**
   * End point (bottom-right) of the rectangle
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  endPoint: { x: number; y: number };
  color: string;
  lineWidth: number;
}

export interface Pin extends BaseDrawing {
  type: 'pin';
  /**
   * Position of the pin target (arrow end point) on the page
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  position: { x: number; y: number };
  /**
   * Position of the bend point for the arrow
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  bendPoint?: { x: number; y: number };
  /**
   * Text content of the pin
   */
  text: string;
  color: string;
}

export interface Line extends BaseDrawing {
  type: 'line';
  /**
   * Start point of the line
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  startPoint: { x: number; y: number };
  /**
   * End point of the line
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  endPoint: { x: number; y: number };
  color: string;
  lineWidth: number;
}

export interface DrawArea extends BaseDrawing {
  type: 'drawArea';
  /**
   * Bounding rectangle of the drawn area
   * Start point (top-left) and end point (bottom-right)
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  color: string;
  lineWidth: number;
}

// Union type for all drawings
export type Drawing = DrawingPath | Rectangle | Pin | Line | DrawArea;

export type DrawingMode = 'freehand' | 'rectangle' | 'pin' | 'text' | 'line' | 'drawArea' | 'none';

// Valid rotation angles: 0, 90, 180, 270 degrees
export type RotationAngle = 0 | 90 | 180 | 270;

export interface ViewerSchema {
  scale: number;
  drawingColor: string;
  drawingLineWidth: number;
  drawingMode: DrawingMode;
  showThumbnails: boolean;
  // Map of page numbers to rotation angles
  pageRotations: Record<number, RotationAngle>;
  // Whether the text layer is enabled
  textLayerEnabled?: boolean;
}

export type Action =
  | { type: 'setScale'; payload: number }
  | { type: 'setDrawingColor'; payload: string }
  | { type: 'setDrawingLineWidth'; payload: number }
  | { type: 'setDrawingMode'; payload: DrawingMode }
  | { type: 'toggleThumbnails' }
  | { type: 'toggleTextLayer' } // Toggle text layer visibility
  | { type: 'rotatePageClockwise'; payload: number } // Page number to rotate
  | { type: 'rotatePageCounterClockwise'; payload: number } // Page number to rotate
  | { type: 'setPageRotation'; payload: { pageNumber: number; angle: number } };
