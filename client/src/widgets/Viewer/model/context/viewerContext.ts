import { createContext, Dispatch } from 'react';
import { Action, RotationAngle, ViewerSchema } from '../types/viewerSchema';

// Define the context type including state and dispatch
interface ViewerContextType {
  state: ViewerSchema;
  dispatch: Dispatch<Action>;
}

const MAX_ZOOM = 5;
const DEFAULT_DRAWING_COLOR = '#2196f3';

// Define a single source of truth for the initial state
export const initialViewerState: ViewerSchema = {
  scale: 1.5,
  drawingColor: DEFAULT_DRAWING_COLOR,
  drawingLineWidth: 2,
  drawingMode: 'none',
  drawings: [], // Single array for all drawing types
  showThumbnails: false,
  pageRotations: {},
  textLayerEnabled: true,
};

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
      console.log('setDrawingMode', action.payload);
      return { ...state, drawingMode: action.payload };

    case 'addDrawing':
      return {
        ...state,
        drawings: [...state.drawings, action.payload],
      };

    case 'clearDrawings':
      // If payload is provided, filter drawings based on criteria
      if (action.payload) {
        const { type, pageNumber } = action.payload;
        
        return {
          ...state,
          drawings: state.drawings.filter((drawing) => {
            // Filter by both type and page number if both are provided
            if (type && pageNumber !== undefined) {
              return drawing.type !== type || drawing.pageNumber !== pageNumber;
            }
            // Filter by type only
            if (type) {
              return drawing.type !== type;
            }
            // Filter by page number only
            if (pageNumber !== undefined) {
              return drawing.pageNumber !== pageNumber;
            }
            // This case shouldn't be reached if payload is provided
            return true;
          }),
        };
      }
      // Otherwise clear all drawings
      return { ...state, drawings: [] };

    case 'toggleThumbnails':
      return { ...state, showThumbnails: !state.showThumbnails };

    case 'toggleTextLayer':
      return { ...state, textLayerEnabled: !state.textLayerEnabled };

    case 'rotatePageClockwise': {
      const pageNumber = action.payload;
      const currentRotation = state.pageRotations[pageNumber] || 0;
      // Calculate new rotation (clockwise: 0 -> 90 -> 180 -> 270 -> 0)
      const newRotation: RotationAngle = ((currentRotation + 90) % 360) as RotationAngle;

      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [pageNumber]: newRotation,
        },
      };
    }

    case 'rotatePageCounterClockwise': {
      const pageNumber = action.payload;
      const currentRotation = state.pageRotations[pageNumber] || 0;
      // Calculate new rotation (counter-clockwise: 0 -> 270 -> 180 -> 90 -> 0)
      const newRotation: RotationAngle = ((currentRotation - 90 + 360) % 360) as RotationAngle;

      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [pageNumber]: newRotation,
        },
      };
    }
    case 'setPageRotation': {
      const { pageNumber, angle } = action.payload;
      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [pageNumber]: angle as RotationAngle,
        },
      };
    }

    default:
      return state;
  }
};

// Create context with proper typing
export const ViewerContext = createContext<ViewerContextType>({
  state: initialViewerState,
  dispatch: () => null,
});
