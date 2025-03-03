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
}

export type DrawingMode = 'freehand' | 'rectangle';

export interface ViewerSchema {
  scale: number;
  drawingColor: string;
  drawingLineWidth: number;
  textLayerEnabled: boolean;
  drawingMode: DrawingMode;
  drawings: DrawingPath[];
  rectangles: Rectangle[];
}

export type Action = 
  | { type: 'setScale'; payload: number }
  | { type: 'setDrawingColor'; payload: string }
  | { type: 'setDrawingLineWidth'; payload: number }
  | { type: 'setDrawingMode'; payload: DrawingMode }
  | { type: 'toggleTextLayer' }
  | { type: 'addDrawing'; payload: DrawingPath }
  | { type: 'addRectangle'; payload: Rectangle }
  | { type: 'clearDrawings'; payload?: number } // Optional page number, if not provided clear all
  | { type: 'clearRectangles'; payload?: number }; // Optional page number, if not provided clear all
