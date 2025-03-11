import { createContext, Dispatch } from 'react';
import { Action, RotationAngle, ViewerSchema } from '../types/viewerSchema';

// Define the context type including state and dispatch
interface ViewerContextType {
  state: ViewerSchema;
  dispatch: Dispatch<Action>;
}

const MAX_ZOOM = 5;
const DEFAULT_DRAWING_COLOR = '#2196f3';

// Define the initial state
export const initialViewerState: ViewerSchema = {
  scale: 1.5, // Initial zoom level
  drawingColor: DEFAULT_DRAWING_COLOR, // Red
  drawingLineWidth: 3,
  drawingMode: 'none',
  showThumbnails: true,
  pageRotations: {},
  textLayerEnabled: true
};

// Create the context with default values
export const ViewerContext = createContext<ViewerContextType>({
  state: initialViewerState,
  dispatch: () => null,
});

// Reducer function to handle state updates
export const viewerReducer = (state: ViewerSchema, action: Action): ViewerSchema => {
  switch (action.type) {
    case 'setScale':
      if (action.payload < 0.5) {
        return { ...state, scale: 0.5 };
      }
      if (action.payload > MAX_ZOOM) {
        return { ...state, scale: MAX_ZOOM };
      }
      return {
        ...state,
        scale: action.payload,
      };
    case 'setDrawingColor':
      return {
        ...state,
        drawingColor: action.payload,
      };
    case 'setDrawingLineWidth':
      return {
        ...state,
        drawingLineWidth: action.payload,
      };
    case 'setDrawingMode':
      console.log('setDrawingMode', action.payload);
      return {
        ...state,
        drawingMode: action.payload,
      };
    case 'toggleThumbnails':
      return {
        ...state,
        showThumbnails: !state.showThumbnails,
      };
    case 'toggleTextLayer':
      return {
        ...state,
        textLayerEnabled: !state.textLayerEnabled,
      };
    case 'rotatePageClockwise':
      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [action.payload]: ((state.pageRotations[action.payload] || 0) + 90) % 360 as RotationAngle,
        },
      };
    case 'rotatePageCounterClockwise':
      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [action.payload]: ((state.pageRotations[action.payload] || 0) + 270) % 360 as RotationAngle,
        },
      };
    case 'setPageRotation':
      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [action.payload.pageNumber]: action.payload.angle as RotationAngle,
        },
      };
    default:
      return state;
  }
};
