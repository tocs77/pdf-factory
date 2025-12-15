/**
 * Canvas utility functions for managing canvas size and pixel ratio
 * to prevent memory issues, especially on mobile devices
 */

// Canvas size limits
const SMALL_SCREEN_MAX_CANVAS_SIZE = 4096; // 4K limit for mobile (smaller to save memory)
const DESKTOP_MAX_CANVAS_SIZE = 16384; // 16K limit for desktop

// Pixel ratio limits
const SMALL_SCREEN_MAX_PIXEL_RATIO = 1.2; // Cap pixel ratio for small screens to save memory

// Screen size thresholds
const SMALL_SCREEN_WIDTH_THRESHOLD = 1024;
const SMALL_SCREEN_HEIGHT_THRESHOLD = 768;

/**
 * Helper function to determine if device is small screen (mobile/tablet)
 * @returns true if screen width < 1024px or height < 768px
 */
export const isSmallScreen = (): boolean => {
  // Consider screens < 1024px width as small screens
  return window.innerWidth < SMALL_SCREEN_WIDTH_THRESHOLD || window.innerHeight < SMALL_SCREEN_HEIGHT_THRESHOLD;
};

/**
 * Get optimal pixel ratio based on screen size
 * Small screens use lower pixelRatio to save memory
 * @returns Optimal pixel ratio for the current device
 */
export const getOptimalPixelRatio = (): number => {
  const devicePixelRatio = window.devicePixelRatio || 1;

  if (isSmallScreen()) {
    // For small screens, cap at SMALL_SCREEN_MAX_PIXEL_RATIO to save memory and prevent crashes
    // Still better than 1.0 for retina displays, but much more memory-efficient
    // Lower than 1.5 to prevent crashes on low-end mobile devices
    return Math.min(devicePixelRatio, SMALL_SCREEN_MAX_PIXEL_RATIO);
  }

  // For larger screens, use full device pixel ratio
  return devicePixelRatio;
};

/**
 * Maximum canvas size to prevent browser memory issues (especially on mobile)
 * Common max is 32767, but mobile devices often have lower limits
 * Use smaller limit for mobile to prevent crashes
 * @returns Maximum canvas size in pixels (4096 for mobile, 16384 for desktop)
 */
export const getMaxCanvasSize = (): number => {
  if (isSmallScreen()) {
    // Mobile devices: Use smaller limit to prevent memory crashes on low-end devices
    return SMALL_SCREEN_MAX_CANVAS_SIZE;
  }
  return DESKTOP_MAX_CANVAS_SIZE;
};
