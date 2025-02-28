import React, { useReducer } from 'react';
import { ViewerContext, viewerReducer } from './viewerContext';

export const ViewerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(viewerReducer, { scale: 1.5 });

  return <ViewerContext.Provider value={{ state, dispatch }}>{children}</ViewerContext.Provider>;
};
