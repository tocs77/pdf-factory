// Base interface for common drawing properties
export interface BaseDrawing {
  id?: string;
  color: string;
  pageNumber: number;
  image?: string; // Store base64 image of the drawing area
}

export interface DrawingPath extends BaseDrawing {
  type: 'freehand';
  /**
   * Array of paths where each path is an array of points representing a single drawing stroke.
   * All coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  paths: Array<{ x: number; y: number }[]>;
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
}

export interface Line extends BaseDrawing {
  type: 'line';
  /**
   * Array of lines, each with a start and end point
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  lines: Array<{
    startPoint: { x: number; y: number };
    endPoint: { x: number; y: number };
  }>;
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
  lineWidth: number;
}

export interface TextUnderline extends BaseDrawing {
  type: 'textUnderline';
  /**
   * Array of line segments for underlining text
   * Each segment represents a line of text to be underlined
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  lines: { start: { x: number, y: number }, end: { x: number, y: number } }[];
  lineWidth: number;
  text?: string; // The text that was underlined (optional)
}

export interface TextCrossedOut extends BaseDrawing {
  type: 'textCrossedOut';
  /**
   * Array of line segments for crossing out text (strikethrough)
   * Each segment represents a line of text to have a line drawn through its center
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  lines: { start: { x: number, y: number }, end: { x: number, y: number } }[];
  lineWidth: number;
  text?: string; // The text that was crossed out (optional)
}

export interface TextHighlight extends BaseDrawing {
  type: 'textHighlight';
  /**
   * Array of rectangle areas for highlighting text
   * Each rectangle represents a line of text to be highlighted
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  rects: { x: number, y: number, width: number, height: number }[];
  opacity: number; // Opacity of the highlight, typically 0.5
  text?: string; // The text that was highlighted (optional)
}

// Union type for all drawings
export type Drawing = DrawingPath | Rectangle | Pin | Line | DrawArea | TextUnderline | TextCrossedOut | TextHighlight;

export type DrawingMode = 'freehand' | 'rectangle' | 'pin' | 'text' | 'line' | 'drawArea' | 'zoomArea' | 'none';

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
