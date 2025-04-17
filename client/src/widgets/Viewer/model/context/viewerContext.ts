import { createContext, Dispatch } from 'react';
import { Action, DrawingMode, RotationAngle, ViewerSchema } from '../types/viewerSchema';

// Define the context type including state and dispatch
interface ViewerContextType {
  state: ViewerSchema;
  dispatch: Dispatch<Action>;
}

const MAX_ZOOM = 5;
const DEFAULT_DRAWING_COLOR = '#2196f3';

// Define the initial state
export const initialViewerState: ViewerSchema = {
  scale: 1.5,
  drawingColor: DEFAULT_DRAWING_COLOR,
  drawingLineWidth: 3,
  drawingMode: 'none',
  showThumbnails: false,
  pageRotations: {},
  textLayerEnabled: true,
  rulerEnabled: false,
  currentDrawingPage: -1,
  compareMode: 'none',
  requestFinishDrawing: false,
  requestCancelDrawing: false,
};

// Create the context with default values
export const ViewerContext = createContext<ViewerContextType>({
  state: initialViewerState,
  dispatch: () => null,
});

const drawingTools: DrawingMode[] = ['freehand', 'rectangle', 'extensionLine', 'line', 'textArea', 'image'];

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
    case 'setDrawingMode': {
      let currentDrawingPage = -1;
      if (drawingTools.includes(action.payload)) {
        currentDrawingPage = state.currentDrawingPage === -1 ? 0 : state.currentDrawingPage;
      }
      return {
        ...state,
        drawingMode: action.payload,
        compareMode:
          drawingTools.includes(action.payload) || action.payload === 'zoomArea' || action.payload === 'ruler'
            ? 'none'
            : state.compareMode,
        currentDrawingPage: currentDrawingPage,
      };
    }

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
    case 'toggleRuler':
      return {
        ...state,
        rulerEnabled: !state.rulerEnabled,
        drawingMode: !state.rulerEnabled ? 'ruler' : 'none',
        compareMode: !state.rulerEnabled ? 'none' : state.compareMode, // Turn off compare when ruler active
      };
    case 'rotatePageClockwise':
      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [action.payload]: (((state.pageRotations[action.payload] || 0) + 90) % 360) as RotationAngle,
        },
      };
    case 'rotatePageCounterClockwise':
      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [action.payload]: (((state.pageRotations[action.payload] || 0) + 270) % 360) as RotationAngle,
        },
      };
    case 'setPageRotation':
      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [action.payload.pageNumber]: action.payload.angle,
        },
      };
    case 'setCurrentDrawingPage': {
      const drawingMode = action.payload !== -1 ? state.drawingMode : 'none';
      return {
        ...state,
        currentDrawingPage: action.payload,
        drawingMode: drawingMode,
      };
    }
    case 'setCompareMode': {
      const newCompareMode = action.payload;
      // Ensure drawing mode is 'none' if activating a compare mode
      const newDrawingMode = newCompareMode !== 'none' ? 'none' : state.drawingMode;
      return {
        ...state,
        compareMode: newCompareMode,
        drawingMode: newDrawingMode,
        // Optionally reset other states like ruler
        rulerEnabled: newCompareMode !== 'none' ? false : state.rulerEnabled,
      };
    }
    case 'requestFinishDrawing':
      return {
        ...state,
        requestFinishDrawing: action.payload,
      };
    case 'requestCancelDrawing':
      return {
        ...state,
        requestCancelDrawing: action.payload,
      };
    default:
      return state;
  }
};
