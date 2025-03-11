import React, { useReducer, ReactNode } from 'react';
import { ViewerContext, viewerReducer, initialViewerState } from './viewerContext';

interface ViewerProviderProps {
  children: ReactNode;
  initialDrawingColor?: string;
  initialDrawingLineWidth?: number;
}

export const ViewerProvider: React.FC<ViewerProviderProps> = ({ 
  children, 
  initialDrawingColor, 
  initialDrawingLineWidth 
}) => {
  // Create an initial state that overrides defaults with provided props
  const customInitialState = {
    ...initialViewerState,
    ...(initialDrawingColor && { drawingColor: initialDrawingColor }),
    ...(initialDrawingLineWidth && { drawingLineWidth: initialDrawingLineWidth }),
  };

  const [state, dispatch] = useReducer(viewerReducer, customInitialState);

  return (
    <ViewerContext.Provider value={{ state, dispatch }}>
      {children}
    </ViewerContext.Provider>
  );
};
