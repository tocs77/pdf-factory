import React, { useReducer, ReactNode, useEffect, useMemo, useRef } from 'react';

import { ViewerContext, viewerReducer, initialViewerState } from './viewerContext';
import { saveViewerState, restoreViewerState } from '../utils/persistViewerState';

interface ViewerProviderProps {
  children: ReactNode;
  initialDrawingColor?: string;
  initialDrawingLineWidth?: number;
}

export const ViewerProvider: React.FC<ViewerProviderProps> = ({ children, initialDrawingColor, initialDrawingLineWidth }) => {
  // Restore persisted state from localStorage
  const persistedState = useMemo(() => restoreViewerState(), []);

  // Create an initial state that overrides defaults with provided props and persisted state
  const customInitialState = {
    ...initialViewerState,
    ...persistedState, // Apply persisted state first
    ...(initialDrawingColor && { drawingColor: initialDrawingColor }),
    ...(initialDrawingLineWidth && { drawingLineWidth: initialDrawingLineWidth }),
  };

  const [state, dispatch] = useReducer(viewerReducer, customInitialState);

  // Track previous drawing menu position to avoid unnecessary saves
  const prevDrawingMenuPositionRef = useRef(state.drawingMenuPosition);

  // Save state to localStorage whenever persisted attributes change
  useEffect(() => {
    const positionChanged =
      prevDrawingMenuPositionRef.current.x !== state.drawingMenuPosition.x ||
      prevDrawingMenuPositionRef.current.y !== state.drawingMenuPosition.y;

    if (positionChanged) {
      saveViewerState(state);
      prevDrawingMenuPositionRef.current = state.drawingMenuPosition;
    }
  }, [state]);

  return <ViewerContext.Provider value={{ state, dispatch }}>{children}</ViewerContext.Provider>;
};
