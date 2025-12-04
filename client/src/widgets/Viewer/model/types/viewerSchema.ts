export type DrawingMode =
  | 'none' // No tool active
  // Text tools
  | 'textHighlight'
  | 'textUnderline'
  | 'textCrossedOut'
  // Drawing tools
  | 'freehand'
  | 'rectangle'
  | 'extensionLine'
  | 'line'
  | 'image'
  | 'zoomArea'
  | 'textArea'
  // Selection tools
  | 'ruler'
  | 'rectSelection'
  | 'pinSelection'
  | 'drawArea';

// Valid rotation angles: 0, 90, 180, 270 degrees
export type RotationAngle = 0 | 90 | 180 | 270;

// Interface for ruler calibration settings
export interface CalibrationSettings {
  pixelsPerUnit: number;
  unitName: string;
}

// Interface for drawing menu position
export interface MenuPosition {
  x: number;
  y: number;
}

export interface ViewerSchema {
  scale: number;
  drawingColor: string;
  drawingLineWidth: number;
  drawingOpacity: number; // Drawing opacity value from 0.25 to 1
  drawingMode: DrawingMode;
  drawingMenuPosition: MenuPosition; // Position of the drawing menu dialog
  showThumbnails: boolean;
  // Map of page numbers to rotation angles
  pageRotations: Record<number, RotationAngle>;
  // Whether the text layer is enabled
  textLayerEnabled?: boolean;
  currentDrawingPage: number; //-1 means no current drawing page   0 means all pages
  currentPage: number; // Current selected/visible page
  compareMode: 'none' | 'diff' | 'sideBySide'; // Type of comparison mode active
  requestFinishDrawing: boolean; // Request to finish current drawing
  requestCancelDrawing: boolean; // Request to cancel current drawing
  // Ruler calibration settings - map of page numbers to calibration settings
  calibration: Record<number, CalibrationSettings>;
  isMobile: boolean;
  isPinchZooming: boolean;
  isWheelZooming: boolean; // Track if user is actively zooming with wheel
  zoomWithCtrl: boolean; // Whether to require Ctrl key for wheel zoom
}

// Action types using discriminated unions
type SetScaleAction = { type: 'setScale'; payload: number };
type SetDrawingColorAction = { type: 'setDrawingColor'; payload: string };
type SetDrawingLineWidthAction = { type: 'setDrawingLineWidth'; payload: number };
type SetDrawingOpacityAction = { type: 'setDrawingOpacity'; payload: number };
type SetDrawingModeAction = { type: 'setDrawingMode'; payload: DrawingMode };
type ToggleThumbnailsAction = { type: 'toggleThumbnails' };
type SetPageRotationAction = { type: 'setPageRotation'; payload: { pageNumber: number; angle: RotationAngle } };
type RotateClockwiseAction = { type: 'rotatePageClockwise'; payload: number };
type RotateCounterClockwiseAction = { type: 'rotatePageCounterClockwise'; payload: number };
type ToggleTextLayerAction = { type: 'toggleTextLayer' };
type ToggleRulerAction = { type: 'toggleRuler' };
// type ToggleCompareModeAction = { type: 'toggleCompareMode' }; // Obsolete
type SetCurrentDrawingPageAction = { type: 'setCurrentDrawingPage'; payload: number };
type SetCompareModeAction = { type: 'setCompareMode'; payload: 'none' | 'diff' | 'sideBySide' }; // New action type
type RequestFinishDrawingAction = { type: 'requestFinishDrawing'; payload: boolean };
type RequestCancelDrawingAction = { type: 'requestCancelDrawing'; payload: boolean };
type SetIsMobileAction = { type: 'setIsMobile'; payload: boolean };

type SetCalibrationAction = {
  type: 'setCalibration';
  payload: {
    pageNumber: number;
    calibration: CalibrationSettings;
  };
};

type ApplyCalibrationAction = {
  type: 'applyCalibration';
  payload: {
    pageNumber: number;
    actualSize: number;
    unitName: string;
    pixelDistance: number;
  };
};

type ResetCalibrationAction = {
  type: 'resetCalibration';
  payload: number; // pageNumber
};

type SetCurrentPageAction = {
  type: 'setCurrentPage';
  payload: number;
};

type SetIsPinchZoomingAction = {
  type: 'setIsPinchZooming';
  payload: boolean;
};

type SetIsWheelZoomingAction = {
  type: 'setIsWheelZooming';
  payload: boolean;
};

type SetZoomWithCtrlAction = {
  type: 'setZoomWithCtrl';
  payload: boolean;
};

type SetDrawingMenuPositionAction = {
  type: 'setDrawingMenuPosition';
  payload: MenuPosition;
};

export type IsDraftDrawing = boolean;
// Remove obsolete toggleCompareMode action type
export type Action =
  | SetScaleAction
  | SetDrawingColorAction
  | SetDrawingLineWidthAction
  | SetDrawingOpacityAction
  | SetDrawingModeAction
  | ToggleThumbnailsAction
  | SetPageRotationAction
  | RotateClockwiseAction
  | RotateCounterClockwiseAction
  | ToggleTextLayerAction
  | ToggleRulerAction
  | SetCurrentDrawingPageAction
  | SetCompareModeAction
  | RequestFinishDrawingAction
  | RequestCancelDrawingAction
  | SetCalibrationAction
  | ApplyCalibrationAction
  | ResetCalibrationAction
  | SetCurrentPageAction
  | SetIsMobileAction
  | SetIsPinchZoomingAction
  | SetIsWheelZoomingAction
  | SetZoomWithCtrlAction
  | SetDrawingMenuPositionAction;
