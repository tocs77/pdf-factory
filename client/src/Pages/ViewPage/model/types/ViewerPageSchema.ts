import { Drawing } from '@/widgets/Viewer';

export const VIEWER_PAGE_SLICE_NAME = 'viewerPage' as const;

export interface ViewerPageSchema {
  drawings: Drawing[];
}

export interface StoreWithViewerPage {
  [VIEWER_PAGE_SLICE_NAME]: ViewerPageSchema;
}
