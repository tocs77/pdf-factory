export interface DrawingPath {
  type: 'freehand';
  /**
   * Array of points representing the drawing path.
   * All coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
  pageNumber: number;
}

export interface Rectangle {
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
  pageNumber: number;
}

export interface Pin {
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
  pageNumber: number;
}

export interface Line {
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
  pageNumber: number;
}

export interface DrawArea {
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
  pageNumber: number;
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
  drawings: Drawing[]; // Single array for all drawing types
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
  | { type: 'addDrawing'; payload: Drawing } // Single action for adding any drawing type
  | { type: 'clearDrawings'; payload?: { type?: DrawingMode; pageNumber?: number } } // Optional parameters for clearing specific types or pages
  | { type: 'toggleThumbnails' }
  | { type: 'toggleTextLayer' } // Toggle text layer visibility
  | { type: 'rotatePageClockwise'; payload: number } // Page number to rotate
  | { type: 'rotatePageCounterClockwise'; payload: number } // Page number to rotate
  | { type: 'setPageRotation'; payload: { pageNumber: number; angle: number } };
