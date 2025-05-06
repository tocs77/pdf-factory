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
  currentDrawingPage: -1,
  currentPage: 1,
  compareMode: 'none',
  requestFinishDrawing: false,
  requestCancelDrawing: false,
  calibration: {
    pixelsPerUnit: 1,
    unitName: 'px',
  },
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
        drawingMode: state.drawingMode === 'ruler' ? 'none' : 'ruler',
      };
    case 'rotatePageClockwise': {
      // Store the current rotation before changing it
      const prevRotation = state.pageRotations[action.payload] || 0;
      const newRotation = ((prevRotation + 90) % 360) as RotationAngle;

      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [action.payload]: newRotation,
        },
        // Always ensure the rotated page is the current page
        currentPage: action.payload,
      };
    }
    case 'rotatePageCounterClockwise': {
      // Store the current rotation before changing it
      const prevRotation = state.pageRotations[action.payload] || 0;
      const newRotation = ((prevRotation + 270) % 360) as RotationAngle;

      return {
        ...state,
        pageRotations: {
          ...state.pageRotations,
          [action.payload]: newRotation,
        },
        // Always ensure the rotated page is the current page
        currentPage: action.payload,
      };
    }
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
    case 'setCalibration':
      return {
        ...state,
        calibration: action.payload,
      };
    case 'applyCalibration': {
      const { actualSize, unitName, pixelDistance } = action.payload;
      // Calculate pixels per unit
      const pixelsPerUnit = pixelDistance / actualSize;

      return {
        ...state,
        calibration: {
          pixelsPerUnit,
          unitName: unitName || '',
        },
      };
    }
    case 'resetCalibration':
      return {
        ...state,
        calibration: {
          pixelsPerUnit: 1,
          unitName: 'px',
        },
      };
    case 'setCurrentPage':
      return {
        ...state,
        currentPage: action.payload,
      };
    default:
      return state;
  }
};
