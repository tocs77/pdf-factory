import { VIEWER_PAGE_SLICE_NAME, StoreWithViewerPage } from '../types/ViewerPageSchema';

export const getDrawings = (state: StoreWithViewerPage) => state[VIEWER_PAGE_SLICE_NAME].drawings;

export const viewerPageSelectors = {
  getDrawings,
};
