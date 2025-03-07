import React, { useReducer } from 'react';
import { ViewerContext, viewerReducer, initialViewerState } from './viewerContext';

export const ViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(viewerReducer, initialViewerState);

  return <ViewerContext.Provider value={{ state, dispatch }}>{children}</ViewerContext.Provider>;
};
