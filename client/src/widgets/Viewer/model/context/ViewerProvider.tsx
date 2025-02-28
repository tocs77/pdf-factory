import React, { useReducer } from 'react';
import { ViewerContext, viewerReducer } from './viewerContext';

const initialState = {
  scale: 1.5,
  drawingColor: '#2196f3',
  drawingLineWidth: 2,
  textLayerEnabled: true,
  drawings: []
};

export const ViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(viewerReducer, initialState);

  return <ViewerContext.Provider value={{ state, dispatch }}>{children}</ViewerContext.Provider>;
};
