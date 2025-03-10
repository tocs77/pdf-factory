export interface DrawingPath {
  /**
   * Array of points representing the drawing path.
   * All coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
  pageNumber: number;
  /**
   * Canvas dimensions at scale=1 when the drawing was created.
   * Used to properly position drawings when rendering at different scales.
   */
  canvasDimensions?: { width: number; height: number };
  /**
   * Rotation angle at which the drawing was created.
   * Used to properly transform coordinates when rendering at different rotation angles.
   */
  rotation?: RotationAngle;
}

export interface Rectangle {
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
  /**
   * Canvas dimensions at scale=1 when the rectangle was created.
   * Used to properly position rectangles when rendering at different scales.
   */
  canvasDimensions?: { width: number; height: number };
  /**
   * Rotation angle at which the rectangle was created.
   * Used to properly transform coordinates when rendering at different rotation angles.
   */
  rotation?: RotationAngle;
}

export interface Pin {
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
  /**
   * Canvas dimensions at scale=1 when the pin was created.
   * Used to properly position pins when rendering at different scales.
   */
  canvasDimensions?: { width: number; height: number };
  /**
   * Rotation angle at which the pin was created.
   * Used to properly transform coordinates when rendering at different rotation angles.
   */
  rotation?: RotationAngle;
}

export interface Line {
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
  /**
   * Canvas dimensions at scale=1 when the line was created.
   * Used to properly position lines when rendering at different scales.
   */
  canvasDimensions?: { width: number; height: number };
  /**
   * Rotation angle at which the line was created.
   * Used to properly transform coordinates when rendering at different rotation angles.
   */
  rotation?: RotationAngle;
}

export interface DrawArea {
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
  /**
   * Canvas dimensions at scale=1 when the drawing area was created.
   * Used to properly position the area when rendering at different scales.
   */
  canvasDimensions?: { width: number; height: number };
  /**
   * Rotation angle at which the drawing area was created.
   * Used to properly transform coordinates when rendering at different rotation angles.
   */
  rotation?: RotationAngle;
}

export type DrawingMode = 'freehand' | 'rectangle' | 'pin' | 'text' | 'line' | 'drawArea' | 'none';

// Valid rotation angles: 0, 90, 180, 270 degrees
export type RotationAngle = 0 | 90 | 180 | 270;

export interface ViewerSchema {
  scale: number;
  drawingColor: string;
  drawingLineWidth: number;
  drawingMode: DrawingMode;
  drawings: DrawingPath[];
  rectangles: Rectangle[];
  pins: Pin[];
  lines: Line[];
  drawAreas: DrawArea[];
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
  | { type: 'addDrawing'; payload: DrawingPath }
  | { type: 'addRectangle'; payload: Rectangle }
  | { type: 'addPin'; payload: Pin }
  | { type: 'addLine'; payload: Line }
  | { type: 'addDrawArea'; payload: DrawArea }
  | { type: 'clearDrawings'; payload?: number } // Optional page number, if not provided clear all
  | { type: 'clearRectangles'; payload?: number } // Optional page number, if not provided clear all
  | { type: 'clearPins'; payload?: number } // Optional page number, if not provided clear all
  | { type: 'clearLines'; payload?: number } // Optional page number, if not provided clear all
  | { type: 'clearDrawAreas'; payload?: number } // Optional page number, if not provided clear all
  | { type: 'toggleThumbnails' }
  | { type: 'toggleTextLayer' } // Toggle text layer visibility
  | { type: 'rotatePageClockwise'; payload: number } // Page number to rotate
  | { type: 'rotatePageCounterClockwise'; payload: number } // Page number to rotate
  | { type: 'setPageRotation'; payload: { pageNumber: number; angle: number } };
