export interface ViewerSchema {
  scale: number;
  drawingColor: string;
  drawingLineWidth: number;
  textLayerEnabled: boolean;
}

export type Action = 
  | { type: 'setScale'; payload: number }
  | { type: 'setDrawingColor'; payload: string }
  | { type: 'setDrawingLineWidth'; payload: number }
  | { type: 'toggleTextLayer' };
