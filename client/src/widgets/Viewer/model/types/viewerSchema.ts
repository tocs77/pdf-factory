export interface DrawingPath {
  points: { x: number; y: number }[];
  color: string;
  lineWidth: number;
  pageNumber: number;
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
