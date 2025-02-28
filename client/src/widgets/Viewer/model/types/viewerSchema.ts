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

export interface ViewerSchema {
  scale: number;
  drawingColor: string;
  drawingLineWidth: number;
  textLayerEnabled: boolean;
  drawings: DrawingPath[];
}

export type Action = 
  | { type: 'setScale'; payload: number }
  | { type: 'setDrawingColor'; payload: string }
  | { type: 'setDrawingLineWidth'; payload: number }
  | { type: 'toggleTextLayer' }
  | { type: 'addDrawing'; payload: DrawingPath }
  | { type: 'clearDrawings'; payload?: number }; // Optional page number, if not provided clear all
