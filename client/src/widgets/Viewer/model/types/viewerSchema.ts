// Base interface for common drawing properties
export interface BaseDrawing {
  id?: string;
  pageNumber: number;
  image?: string; // Store base64 image of the drawing area
  // Bounding box coordinates for the drawing - normalized to scale=1
  boundingBox: {
    top: number;
    left: number;
    right: number;
    bottom: number;
  };
}

// Common style properties for drawings
export interface DrawingStyle {
  strokeColor: string;
  strokeWidth: number;
}

export interface DrawingPath extends BaseDrawing {
  type: 'freehand';
  /**
   * Array of paths where each path is an array of points representing a single drawing stroke.
   * All coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  paths: Array<{ x: number; y: number }[]>;
  /**
   * Style properties for the entire drawing (used as default)
   */
  style: DrawingStyle;
  /**
   * Optional per-path style overrides. Allows different colors and line widths for each path.
   * Index corresponds to the path index in the paths array.
   */
  pathStyles?: DrawingStyle[];
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
  /**
   * Style properties for the rectangle
   */
  style: DrawingStyle;
}

export interface ExtensionLine extends BaseDrawing {
  type: 'extensionLine';
  /**
   * Position of the extension line target (arrow end point) on the page
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  position: { x: number; y: number };
  /**
   * Position of the bend point for the arrow
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  bendPoint?: { x: number; y: number };
  /**
   * Text content of the extension line
   */
  text: string;
  /**
   * Color of the extension line
   */
  color: string;
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
  /**
   * Style properties for the entire line drawing (used as default)
   */
  style: DrawingStyle;
  /**
   * Optional per-line style overrides. Allows different colors and line widths for each line.
   * Index corresponds to the line index in the lines array.
   */
  lineStyles?: DrawingStyle[];
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
  /**
   * Style properties for the draw area
   */
  style: DrawingStyle;
}

export interface TextUnderline extends BaseDrawing {
  type: 'textUnderline';
  /**
   * Array of line segments for underlining text
   * Each segment represents a line of text to be underlined
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  lines: { start: { x: number; y: number }; end: { x: number; y: number } }[];
  /**
   * Style properties for the text underline
   */
  style: DrawingStyle;
  text?: string; // The text that was underlined (optional)
}

export interface TextCrossedOut extends BaseDrawing {
  type: 'textCrossedOut';
  /**
   * Array of line segments for crossing out text (strikethrough)
   * Each segment represents a line of text to have a line drawn through its center
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  lines: { start: { x: number; y: number }; end: { x: number; y: number } }[];
  /**
   * Style properties for the text cross-out
   */
  style: DrawingStyle;
  text?: string; // The text that was crossed out (optional)
}

export interface TextHighlight extends BaseDrawing {
  type: 'textHighlight';
  /**
   * Array of rectangles for highlighting text
   * Each rectangle covers a section of text to be highlighted
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  rects: Array<{ x: number; y: number; width: number; height: number }>;
  /**
   * Style properties for the text highlight
   */
  style: DrawingStyle;
  /**
   * Optional opacity for the highlight (0-1)
   */
  opacity?: number;
  text?: string; // The text that was highlighted (optional)
}

export interface TextArea extends BaseDrawing {
  type: 'textArea';
  /**
   * Start point (top-left) of the text area rectangle
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  startPoint: { x: number; y: number };
  /**
   * End point (bottom-right) of the text area rectangle
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  endPoint: { x: number; y: number };
  /**
   * Text content within the area
   */
  text: string;
  /**
   * Style properties for the text area
   */
  style: DrawingStyle;
}

export interface DrawingMisc extends BaseDrawing {
  type: 'misc';
  pathes: DrawingPath[];
  rectangles: Rectangle[];
  extensionLines: ExtensionLine[];
  lines: Line[];
  textAreas: TextArea[];
}

// Union type for all drawings
export type Drawing =
  | DrawingPath
  | Rectangle
  | ExtensionLine
  | Line
  | DrawArea
  | TextUnderline
  | TextCrossedOut
  | TextHighlight
  | TextArea
  | DrawingMisc;

export type DrawingMode =
  | 'freehand'
  | 'rectangle'
  | 'extensionLine'
  | 'textHighlight'
  | 'textUnderline'
  | 'textCrossedOut'
  | 'line'
  | 'drawArea'
  | 'zoomArea'
  | 'textArea'
  | 'ruler'
  | 'none';

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
  // Whether the ruler tool is enabled
  rulerEnabled?: boolean;
  isDraftDrawing: boolean;
}

export type Action =
  | { type: 'setScale'; payload: number }
  | { type: 'setDrawingColor'; payload: string }
  | { type: 'setDrawingLineWidth'; payload: number }
  | { type: 'setDrawingMode'; payload: DrawingMode }
  | { type: 'toggleThumbnails' }
  | { type: 'toggleTextLayer' } // Toggle text layer visibility
  | { type: 'toggleRuler' } // Toggle ruler tool
  | { type: 'rotatePageClockwise'; payload: number } // Page number to rotate
  | { type: 'rotatePageCounterClockwise'; payload: number } // Page number to rotate
  | { type: 'setPageRotation'; payload: { pageNumber: number; angle: number } }
  | { type: 'setIsDraftDrawing'; payload: boolean };
