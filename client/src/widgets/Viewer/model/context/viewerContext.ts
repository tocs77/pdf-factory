import { createContext, Dispatch } from 'react';
import { Action, ViewerSchema } from '../types/viewerSchema';

// Define the context type including state and dispatch
interface ViewerContextType {
  state: ViewerSchema;
  dispatch: Dispatch<Action>;
}

const MAX_ZOOM = 5;
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
    default:
      return state;
  }
};

// Create context with proper typing
export const ViewerContext = createContext<ViewerContextType>({
  state: { scale: 1 },
  dispatch: () => null,
});
