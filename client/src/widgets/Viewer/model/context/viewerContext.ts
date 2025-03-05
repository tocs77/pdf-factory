import { createContext, Dispatch } from 'react';
import { Action, ViewerSchema } from '../types/viewerSchema';

// Define the context type including state and dispatch
interface ViewerContextType {
  state: ViewerSchema;
  dispatch: Dispatch<Action>;
}

const MAX_ZOOM = 5;
const DEFAULT_DRAWING_COLOR = '#2196f3';

export const viewerReducer = (state: ViewerSchema, action: Action): ViewerSchema => {
  switch (action.type) {
    case 'setScale':
      if (action.payload < 0.5) {
        return { ...state, scale: 0.5 };
      }
      if (action.payload > MAX_ZOOM) {
        return { ...state, scale: MAX_ZOOM };
      }
      return { ...state, scale: action.payload };
    
    case 'setDrawingColor':
      return { ...state, drawingColor: action.payload };
    
    case 'setDrawingLineWidth':
      return { ...state, drawingLineWidth: action.payload };
    
    case 'setDrawingMode':
      return { ...state, drawingMode: action.payload };
    
    case 'toggleTextLayer':
      return { ...state, textLayerEnabled: !state.textLayerEnabled };
    
    case 'addDrawing':
      return { 
        ...state, 
        drawings: [...state.drawings, action.payload] 
      };
    
    case 'addRectangle':
      return {
        ...state,
        rectangles: [...state.rectangles, action.payload]
      };
    
    case 'clearDrawings':
      // If payload is provided, clear drawings for that page only
      if (action.payload !== undefined) {
        return {
          ...state,
          drawings: state.drawings.filter(drawing => drawing.pageNumber !== action.payload)
        };
      }
      // Otherwise clear all drawings
      return { ...state, drawings: [] };
    
    case 'clearRectangles':
      // If payload is provided, clear rectangles for that page only
      if (action.payload !== undefined) {
        return {
          ...state,
          rectangles: state.rectangles.filter(rect => rect.pageNumber !== action.payload)
        };
      }
      // Otherwise clear all rectangles
      return { ...state, rectangles: [] };
    
    case 'toggleThumbnails':
      return { ...state, showThumbnails: !state.showThumbnails };
    
    default:
      return state;
  }
};

// Create context with proper typing
export const ViewerContext = createContext<ViewerContextType>({
  state: { 
    scale: 1.5,
    drawingColor: DEFAULT_DRAWING_COLOR,
    drawingLineWidth: 2,
    textLayerEnabled: true,
    drawingMode: 'freehand',
    drawings: [],
    rectangles: [],
    showThumbnails: true
  },
  dispatch: () => null,
});
