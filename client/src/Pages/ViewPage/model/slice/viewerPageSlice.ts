import { PayloadAction, createSlice } from '@reduxjs/toolkit';

import { VIEWER_PAGE_SLICE_NAME, ViewerPageSchema } from '../types/ViewerPageSchema';
import { Drawing } from '@/widgets/Viewer';
import { generateUUID } from '@/shared/utils';

const initialState: ViewerPageSchema = {
  drawings: [],
};

const viewerPageSlice = createSlice({
  name: VIEWER_PAGE_SLICE_NAME,
  initialState: initialState,
  reducers: {
    setDrawings(state, action: PayloadAction<Drawing[]>) {
      state.drawings = action.payload;
    },
    addDrawing(state, action: PayloadAction<Omit<Drawing, 'id'>>) {
      state.drawings.push({ ...action.payload, id: generateUUID() } as Drawing);
    },
    clearDrawings(state) {
      state.drawings = [];
    },
  },
});

export const { reducer: viewerPageReducer } = viewerPageSlice;
export const viewerPageActions = {
  ...viewerPageSlice.actions,
};
