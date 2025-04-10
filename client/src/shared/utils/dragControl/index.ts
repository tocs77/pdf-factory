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
