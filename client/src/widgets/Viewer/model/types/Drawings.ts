// Base interface for common drawing properties
export interface BaseDrawing {
  id: string;
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
  opacity?: number; // Opacity value from 0 to 1, defaults to 1 if not specified
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
  /**
   * Font size for the text (in pixels at scale=1)
   */
  fontSize?: number;
}

export interface RectSelection extends BaseDrawing {
  type: 'rectSelection';
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
  style: DrawingStyle;
}

export interface PinSelection extends BaseDrawing {
  type: 'pinSelection';
  /**
   * Position of the pin
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  position: { x: number; y: number };
  /**
   * Color of the pin (optional)
   */
  color?: string;
}

export interface DrawingMisc extends BaseDrawing {
  type: 'misc';
  pathes: DrawingPath[];
  rectangles: Rectangle[];
  extensionLines: ExtensionLine[];
  lines: Line[];
  textAreas: TextArea[];
  images: ImageAnnotation[];
}

export interface ImageAnnotation extends BaseDrawing {
  type: 'image';
  /**
   * Start point (top-left) of the image area
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  startPoint: { x: number; y: number };
  /**
   * End point (bottom-right) of the image area
   * Coordinates are normalized to scale=1 for consistent rendering across different zoom levels.
   */
  endPoint: { x: number; y: number };
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
  | DrawingMisc
  | RectSelection
  | PinSelection
  | ImageAnnotation;
