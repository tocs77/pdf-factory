import { ViewerSchema } from '../types/viewerSchema';

const STORAGE_KEY = 'pdf-viewer-state';

/**
 * Define which attributes to persist
 *
 * To add more attributes:
 * 1. Add the attribute to this interface
 * 2. Add it to stateToPersist in saveViewerState()
 * 3. Add validation and restoration in restoreViewerState()
 * 4. Update the useEffect dependency in ViewerProvider to track changes
 */
type PersistedViewerState = Pick<ViewerSchema, 'drawingMenuPosition'>;

/**
 * Save selected viewer state attributes to local storage
 */
export const saveViewerState = (state: ViewerSchema): void => {
  try {
    const stateToPersist: PersistedViewerState = {
      drawingMenuPosition: state.drawingMenuPosition,
      // Add more attributes here as needed
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
  } catch (error) {
    console.error('Failed to save viewer state to localStorage:', error);
  }
};

/**
 * Restore selected viewer state attributes from local storage
 * Returns partial state object with only the persisted attributes
 */
export const restoreViewerState = (): Partial<ViewerSchema> => {
  try {
    const savedState = localStorage.getItem(STORAGE_KEY);

    if (!savedState) {
      return {};
    }

    const parsedState: PersistedViewerState = JSON.parse(savedState);

    // Validate and return only the attributes we want to restore
    const restoredState: Partial<ViewerSchema> = {};

    if (parsedState.drawingMenuPosition) {
      // Validate the position has x and y properties
      if (typeof parsedState.drawingMenuPosition.x === 'number' && typeof parsedState.drawingMenuPosition.y === 'number') {
        restoredState.drawingMenuPosition = parsedState.drawingMenuPosition;
      }
    }

    return restoredState;
  } catch (error) {
    console.error('Failed to restore viewer state from localStorage:', error);
    return {};
  }
};

/**
 * Clear persisted viewer state from local storage
 */
export const clearViewerState = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear viewer state from localStorage:', error);
  }
};
