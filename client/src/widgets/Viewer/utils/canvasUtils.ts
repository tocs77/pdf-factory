/**
 * Canvas utility functions for managing canvas size and pixel ratio
 * to prevent memory issues, especially on mobile devices
 */

/**
 * Helper function to determine if device is small screen (mobile/tablet)
 * @returns true if screen width < 1024px or height < 768px
 */
export const isSmallScreen = (): boolean => {
  // Consider screens < 1024px width as small screens
  return window.innerWidth < 1024 || window.innerHeight < 768;
};

/**
 * Get optimal pixel ratio based on screen size
 * Small screens use lower pixelRatio to save memory
 * @returns Optimal pixel ratio for the current device
 */
export const getOptimalPixelRatio = (): number => {
  const devicePixelRatio = window.devicePixelRatio || 1;

  if (isSmallScreen()) {
    // For small screens, cap at 1.2 to save memory and prevent crashes
    // Still better than 1.0 for retina displays, but much more memory-efficient
    // Lower than 1.5 to prevent crashes on low-end mobile devices
    return Math.min(devicePixelRatio, 1.2);
  }

  // For larger screens, use full device pixel ratio
  return devicePixelRatio;
};

/**
 * Maximum canvas size to prevent browser memory issues (especially on mobile)
 * Common max is 32767, but mobile devices often have lower limits
 * Use smaller limit for mobile to prevent crashes
 * @returns Maximum canvas size in pixels (8192 for mobile, 16384 for desktop)
 */
export const getMaxCanvasSize = (): number => {
  if (isSmallScreen()) {
    // Mobile devices: Use smaller limit (8MB per canvas instead of ~189MB)
    // This prevents memory crashes on low-end devices
    return 8192; // 8K limit for mobile
  }
  return 16384; // 16K limit for desktop
};
