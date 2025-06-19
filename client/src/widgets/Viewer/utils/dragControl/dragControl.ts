/**
 * Drag Control Utility
 *
 * This utility helps manage drag state across components
 * to prevent conflicts between different drag operations.
 */

// Global state to track if slider is being dragged
let isSliderDragging = false;

// Get current slider dragging state
export const isSliderBeingDragged = (): boolean => {
  return isSliderDragging;
};

// Set slider dragging state
export const setSliderDragging = (isDragging: boolean): void => {
  isSliderDragging = isDragging;

  // Add or remove a global class for styling
  if (isDragging) {
    document.body.classList.add('slider-dragging');
  } else {
    document.body.classList.remove('slider-dragging');
  }
};

// Force release all drag operations
export const forceReleaseDrag = (): void => {
  isSliderDragging = false;
  document.body.classList.remove('slider-dragging');
  document.body.classList.remove('resizingHorizontal');

  // Dispatch a synthetic mouseup event as a fallback
  const event = new MouseEvent('mouseup', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  document.dispatchEvent(event);
};

// Setup global safety net
(() => {
  // Global mouseup handler as a safety measure
  const globalMouseUpHandler = () => {
    if (isSliderDragging) {
      forceReleaseDrag();
    }
  };

  // Listen for window blur to handle cases where mouseup happens outside window
  const windowBlurHandler = () => {
    if (isSliderDragging) {
      forceReleaseDrag();
    }
  };

  // Add global safety event listeners
  window.addEventListener('mouseup', globalMouseUpHandler);
  window.addEventListener('blur', windowBlurHandler);
})();
