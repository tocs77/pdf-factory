import { useCallback, useEffect, useRef } from 'react';
import { Action } from '../model/types/viewerSchema';

// Zoom configuration constants
const WHEEL_ZOOM_DELTA = 0.2; // 20% zoom per wheel event (increased from 15%)
const ZOOM_FINALIZE_DELAY_MS = 300; // Wait 300ms after last wheel event before finalizing
const MIN_ZOOM_SCALE = 0.5; // Minimum zoom level (50%)
const MAX_ZOOM_SCALE = 5; // Maximum zoom level (500%)
const ZOOM_TRANSITION_DURATION = '0.05s'; // CSS transition duration (faster, was 0.08s)

// Acceleration configuration - makes zoom faster when scrolling rapidly
const ENABLE_ZOOM_ACCELERATION = true; // Enable/disable acceleration feature
const ACCELERATION_THRESHOLD_MS = 200; // Time window to detect rapid scrolling (more forgiving, was 100ms)
const ACCELERATION_MULTIPLIER = 1.8; // Speed multiplier per rapid event (was 2.5)
const MAX_ACCELERATION_MULTIPLIER = 5; // Maximum acceleration cap (increased from 4x)

interface UseZoomToMouseProps {
  scale: number;
  dispatch: React.Dispatch<Action>;
  containerRef: React.RefObject<HTMLDivElement>;
  zoomWithCtrl: boolean;
}

export const useZoomToMouse = ({ scale, dispatch, containerRef, zoomWithCtrl }: UseZoomToMouseProps) => {
  // Use ref to track scale without recreating event listeners
  const scaleRef = useRef(scale);
  const lastLoggedScaleRef = useRef(scale);

  useEffect(() => {
    scaleRef.current = scale;
    lastLoggedScaleRef.current = scale;
  }, [scale]);

  // Use ref to track zoomWithCtrl without recreating event listeners
  const zoomWithCtrlRef = useRef(zoomWithCtrl);
  useEffect(() => {
    zoomWithCtrlRef.current = zoomWithCtrl;
  }, [zoomWithCtrl]);

  // Add a lock to prevent concurrent zoom operations
  const isZoomingRef = useRef(false);

  // Ref to track the debounce timeout for wheel zooming end detection
  const zoomEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track cumulative CSS transform scale during zoom gesture
  const cumulativeTransformScaleRef = useRef<number>(1);
  const activeZoomPageRef = useRef<HTMLElement | null>(null);
  const zoomMousePositionRef = useRef<{ x: number; y: number; percentX: number; percentY: number } | null>(null);

  // Track wheel event timing for acceleration
  const lastWheelEventTimeRef = useRef<number>(0);
  const accelerationMultiplierRef = useRef<number>(1);

  // Track if finalization is in progress
  const isFinalizingRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      // Clean up timeout on unmount
      if (zoomEndTimeoutRef.current) {
        clearTimeout(zoomEndTimeoutRef.current);
      }
    };
  }, []);

  // Find the page element that's most visible in the viewport
  const findVisiblePageElement = useCallback(() => {
    if (!containerRef.current) return null;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();

    // Get all page elements
    const pageElements = Array.from(container.querySelectorAll('[data-page-number]'));
    let bestVisiblePage = null;
    let bestVisibleArea = 0;

    for (const pageEl of pageElements) {
      const pageRect = pageEl.getBoundingClientRect();

      // Calculate how much of the page is visible in the viewport
      const visibleTop = Math.max(pageRect.top, containerRect.top);
      const visibleBottom = Math.min(pageRect.bottom, containerRect.bottom);
      const visibleLeft = Math.max(pageRect.left, containerRect.left);
      const visibleRight = Math.min(pageRect.right, containerRect.right);

      // Skip if the page is not visible
      if (visibleTop >= visibleBottom || visibleLeft >= visibleRight) {
        continue;
      }

      // Calculate the visible area
      const visibleWidth = visibleRight - visibleLeft;
      const visibleHeight = visibleBottom - visibleTop;
      const visibleArea = visibleWidth * visibleHeight;

      // Update the best visible page if this one has a larger visible area
      if (visibleArea > bestVisibleArea) {
        bestVisibleArea = visibleArea;
        bestVisiblePage = pageEl;
      }
    }

    return bestVisiblePage;
  }, [containerRef]);

  // Function to handle zoom end with debounce
  const handleZoomEnd = useCallback(() => {
    // Clear any existing timeout
    if (zoomEndTimeoutRef.current) {
      clearTimeout(zoomEndTimeoutRef.current);
    }

    // Set new timeout to finalize zoom after configured delay
    zoomEndTimeoutRef.current = setTimeout(() => {
      isFinalizingRef.current = true;

      const pageElement = activeZoomPageRef.current;
      const mousePos = zoomMousePositionRef.current;
      const container = containerRef.current;

      if (pageElement && mousePos && container) {
        // Calculate final scale
        const baseScale = scaleRef.current;
        const finalScale = Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, baseScale * cumulativeTransformScaleRef.current));
        const scaleRatio = finalScale / baseScale;

        // Get current page dimensions BEFORE removing transform
        const pageRectBeforeFinalize = pageElement.getBoundingClientRect();

        // Remove CSS transform smoothly
        pageElement.style.transition = '';
        pageElement.style.transform = '';
        pageElement.style.transformOrigin = '';

        // Reset cumulative scale BEFORE applying new React scale
        // This prevents the next wheel event from seeing stale cumulative value
        cumulativeTransformScaleRef.current = 1;

        // Apply final scale to React state (triggers re-render)
        dispatch({ type: 'setScale', payload: finalScale });

        // Wait for React to render new scale, then adjust scroll
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // Get page position and dimensions after render
            const finalPageRect = pageElement.getBoundingClientRect();

            // Check if dimensions have actually changed
            const expectedWidth = pageRectBeforeFinalize.width * scaleRatio;
            const expectedHeight = pageRectBeforeFinalize.height * scaleRatio;
            const widthChanged = Math.abs(finalPageRect.width - expectedWidth) > 1;
            const heightChanged = Math.abs(finalPageRect.height - expectedHeight) > 1;

            // Use calculated dimensions if DOM hasn't updated yet
            const effectivePageWidth = widthChanged ? finalPageRect.width : expectedWidth;
            const effectivePageHeight = heightChanged ? finalPageRect.height : expectedHeight;

            // Calculate the point on the scaled page (in page-local coordinates)
            const pointXInPage = effectivePageWidth * mousePos.percentX;
            const pointYInPage = effectivePageHeight * mousePos.percentY;

            // Calculate where this point currently is in viewport coordinates
            const currentPointX = finalPageRect.left + pointXInPage;
            const currentPointY = finalPageRect.top + pointYInPage;

            // Calculate where we want the point to be (original mouse position in viewport)
            const targetPointX = mousePos.x;
            const targetPointY = mousePos.y;

            // Calculate the difference
            const deltaX = currentPointX - targetPointX;
            const deltaY = currentPointY - targetPointY;

            // Apply scroll adjustment
            const maxScrollLeft = container.scrollWidth - container.clientWidth;
            const maxScrollTop = container.scrollHeight - container.clientHeight;

            const newScrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + deltaX));
            const newScrollTop = Math.max(0, Math.min(maxScrollTop, container.scrollTop + deltaY));

            container.scrollLeft = newScrollLeft;
            container.scrollTop = newScrollTop;

            // Mark finalization complete
            isFinalizingRef.current = false;

            // Check if a new zoom gesture has already started (cumulative scale != 1)
            if (cumulativeTransformScaleRef.current === 1) {
              // No new zoom started - safe to clean up completely
              dispatch({ type: 'setIsWheelZooming', payload: false });
              activeZoomPageRef.current = null;
              zoomMousePositionRef.current = null;
              isZoomingRef.current = false;
              lastWheelEventTimeRef.current = 0;
              accelerationMultiplierRef.current = 1;
            }
            // If new zoom already in progress, keep refs alive and don't set isWheelZooming to false
          });
        });
      } else {
        // No active zoom data, just mark as complete
        isFinalizingRef.current = false;
        dispatch({ type: 'setIsWheelZooming', payload: false });
        cumulativeTransformScaleRef.current = 1;
        activeZoomPageRef.current = null;
        zoomMousePositionRef.current = null;
        isZoomingRef.current = false;
        lastWheelEventTimeRef.current = 0;
        accelerationMultiplierRef.current = 1;
      }

      zoomEndTimeoutRef.current = null;
    }, ZOOM_FINALIZE_DELAY_MS);
  }, [dispatch, containerRef]);

  // Prevent browser zoom on Ctrl+wheel globally
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      // Check if zoom should be triggered based on zoomWithCtrl setting
      const shouldZoom = zoomWithCtrlRef.current ? e.ctrlKey : true;

      if (shouldZoom) {
        e.preventDefault();
        e.stopPropagation();

        // Check if a zoom operation is already in progress
        if (isZoomingRef.current) {
          return false;
        }

        // Get the container element
        const container = containerRef.current;
        if (!container) return false;

        // Check if the mouse is over a page element
        const target = e.target as HTMLElement;
        const pageElement = target.closest('[data-page-number]') as HTMLElement;

        // Only zoom if the mouse is over a page
        if (!pageElement) return false;

        // Get page element dimensions and position
        const pageRect = pageElement.getBoundingClientRect();

        // Calculate mouse position relative to the page
        const mouseXRelativePage = e.clientX - pageRect.left;
        const mouseYRelativePage = e.clientY - pageRect.top;

        // Calculate mouse position as a percentage of page dimensions
        const mouseXPercentPage = mouseXRelativePage / pageRect.width;
        const mouseYPercentPage = mouseYRelativePage / pageRect.height;

        // Store mouse client coordinates
        const mouseClientX = e.clientX;
        const mouseClientY = e.clientY;

        // SIMPLIFIED APPROACH: Use CSS transform during zoom gesture, finalize on zoom end

        // Calculate acceleration based on wheel event frequency
        const now = performance.now();
        const timeSinceLastWheel = now - lastWheelEventTimeRef.current;
        lastWheelEventTimeRef.current = now;

        let currentAcceleration = 1;
        if (ENABLE_ZOOM_ACCELERATION && timeSinceLastWheel > 0) {
          if (timeSinceLastWheel < ACCELERATION_THRESHOLD_MS) {
            // User is scrolling rapidly - increase acceleration
            accelerationMultiplierRef.current = Math.min(
              accelerationMultiplierRef.current * ACCELERATION_MULTIPLIER,
              MAX_ACCELERATION_MULTIPLIER,
            );
            currentAcceleration = accelerationMultiplierRef.current;
          } else {
            // Reset acceleration on slow scroll
            accelerationMultiplierRef.current = 1;
            currentAcceleration = 1;
          }
        }

        // Apply acceleration to zoom delta
        const baseDelta = e.deltaY > 0 ? -WHEEL_ZOOM_DELTA : WHEEL_ZOOM_DELTA;
        const delta = baseDelta * currentAcceleration;

        // Mark that wheel zooming is active (prevents expensive page re-renders)
        if (!isZoomingRef.current) {
          dispatch({ type: 'setIsWheelZooming', payload: true });
          isZoomingRef.current = true;
        }

        // Check if this is a continuation or new gesture
        const isSamePage = activeZoomPageRef.current === pageElement;
        const isNewGesture = !activeZoomPageRef.current || !isSamePage;

        if (isNewGesture) {
          // New zoom gesture on a different page OR first gesture ever
          activeZoomPageRef.current = pageElement;

          // Set transform origin once at start of zoom gesture
          const transformOriginX = (mouseXPercentPage * 100).toFixed(2);
          const transformOriginY = (mouseYPercentPage * 100).toFixed(2);
          pageElement.style.transformOrigin = `${transformOriginX}% ${transformOriginY}%`;
        }

        // Always update mouse position for accurate scroll adjustment during finalization
        zoomMousePositionRef.current = {
          x: mouseClientX,
          y: mouseClientY,
          percentX: mouseXPercentPage,
          percentY: mouseYPercentPage,
        };

        // Update cumulative transform scale
        const scaleDelta = 1 + delta;
        cumulativeTransformScaleRef.current *= scaleDelta;

        // Clamp cumulative scale to configured limits
        const currentBaseScale = scaleRef.current;
        const proposedFinalScale = currentBaseScale * cumulativeTransformScaleRef.current;

        if (proposedFinalScale < MIN_ZOOM_SCALE) {
          cumulativeTransformScaleRef.current = MIN_ZOOM_SCALE / currentBaseScale;
        } else if (proposedFinalScale > MAX_ZOOM_SCALE) {
          cumulativeTransformScaleRef.current = MAX_ZOOM_SCALE / currentBaseScale;
        }

        // Apply smooth CSS transform for instant visual feedback
        pageElement.style.transform = `scale(${cumulativeTransformScaleRef.current})`;
        pageElement.style.transition = `transform ${ZOOM_TRANSITION_DURATION} ease-out`;

        // Reset zoom end timer (will finalize when wheel stops)
        handleZoomEnd();

        return false;
      }
      return true;
    };

    // Add the event listener to the document with capture phase to ensure it runs first
    document.addEventListener('wheel', preventBrowserZoom, { passive: false, capture: true });

    // Add the event listener to the window object as well for better coverage
    window.addEventListener('wheel', preventBrowserZoom, { passive: false, capture: true });

    // Clean up
    return () => {
      document.removeEventListener('wheel', preventBrowserZoom, { capture: true });
      window.removeEventListener('wheel', preventBrowserZoom, { capture: true });
    };
  }, [dispatch, containerRef, handleZoomEnd]);

  // Prevent browser zoom shortcuts
  useEffect(() => {
    const preventBrowserZoomShortcuts = (e: KeyboardEvent) => {
      // Prevent browser zoom shortcuts (Ctrl+Plus, Ctrl+Minus, Ctrl+0)
      if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_' || e.key === '0')) {
        e.preventDefault();
        e.stopPropagation();

        // Check if a zoom operation is already in progress
        if (isZoomingRef.current) {
          return false;
        }

        // Get the container element
        const container = containerRef.current;
        if (!container) return false;

        // Find the most visible page to focus on
        const visiblePage = findVisiblePageElement();
        if (!visiblePage) return false;

        const pageElement = visiblePage as HTMLElement;

        // Get container dimensions
        const containerRect = container.getBoundingClientRect();

        // Get page element dimensions and position
        const pageRect = pageElement.getBoundingClientRect();

        // Calculate the viewport center
        const viewportCenterX = containerRect.left + containerRect.width / 2;
        const viewportCenterY = containerRect.top + containerRect.height / 2;

        // Calculate the position relative to the page
        const relativeX = Math.max(0, Math.min(1, (viewportCenterX - pageRect.left) / pageRect.width));
        const relativeY = Math.max(0, Math.min(1, (viewportCenterY - pageRect.top) / pageRect.height));

        // Use these relative positions for the center point
        const centerXPercentPage = relativeX;
        const centerYPercentPage = relativeY;

        // Handle our custom zoom functionality for keyboard shortcuts
        const oldScale = scaleRef.current;
        let newScale = oldScale;
        if (e.key === '+' || e.key === '=') {
          // Zoom in
          newScale = Math.min(5, oldScale + 0.1);
        } else if (e.key === '-' || e.key === '_') {
          // Zoom out
          newScale = Math.max(0.5, oldScale - 0.1);
        } else if (e.key === '0') {
          // Reset zoom
          newScale = 1.5;
        }

        if (newScale !== oldScale) {
          // For keyboard shortcuts, just update scale and adjust scroll
          dispatch({ type: 'setScale', payload: newScale });

          // Adjust scroll after render to keep viewport center fixed
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              const updatedPageRect = pageElement.getBoundingClientRect();

              // Calculate where the center point should be
              const pointX = updatedPageRect.left + updatedPageRect.width * centerXPercentPage;
              const pointY = updatedPageRect.top + updatedPageRect.height * centerYPercentPage;

              // Calculate scroll adjustment
              const deltaX = pointX - viewportCenterX;
              const deltaY = pointY - viewportCenterY;

              // Apply scroll adjustment
              const maxScrollLeft = container.scrollWidth - container.clientWidth;
              const maxScrollTop = container.scrollHeight - container.clientHeight;

              container.scrollLeft = Math.max(0, Math.min(maxScrollLeft, container.scrollLeft + deltaX));
              container.scrollTop = Math.max(0, Math.min(maxScrollTop, container.scrollTop + deltaY));
            });
          });
        }

        return false;
      }
      return true;
    };

    // Add the event listener to the document
    document.addEventListener('keydown', preventBrowserZoomShortcuts, { capture: true });

    // Clean up
    return () => {
      document.removeEventListener('keydown', preventBrowserZoomShortcuts, { capture: true });
    };
  }, [dispatch, findVisiblePageElement, containerRef, handleZoomEnd]);

  // Function to handle scale changes and preserve scroll position
  const handleScaleChange = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    // Find the most visible page and its relative position
    const visiblePage = findVisiblePageElement();

    if (!visiblePage) {
      // Fallback to simple ratio-based scrolling if no visible page found
      const scrollTop = container.scrollTop;
      const scrollLeft = container.scrollLeft;
      const scrollHeight = container.scrollHeight;
      const scrollWidth = container.scrollWidth;
      const containerHeight = container.clientHeight;
      const containerWidth = container.clientWidth;

      // Calculate vertical and horizontal scroll ratios
      const verticalScrollRatio = scrollTop / Math.max(1, scrollHeight - containerHeight);
      const horizontalScrollRatio = scrollLeft / Math.max(1, scrollWidth - containerWidth);

      // Apply new scroll position after DOM update
      setTimeout(() => {
        if (!container) return;
        const newScrollHeight = container.scrollHeight;
        const newScrollWidth = container.scrollWidth;
        const newContainerHeight = container.clientHeight;
        const newContainerWidth = container.clientWidth;

        const newScrollTop = verticalScrollRatio * Math.max(1, newScrollHeight - newContainerHeight);
        const newScrollLeft = horizontalScrollRatio * Math.max(1, newScrollWidth - newContainerWidth);

        container.scrollTop = newScrollTop;
        container.scrollLeft = newScrollLeft;
      }, 100);

      return;
    }

    // Get the page number and position
    const pageElement = visiblePage as HTMLElement;
    const pageRect = pageElement.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    // Calculate the visible center of the page
    const visibleTop = Math.max(pageRect.top, containerRect.top);
    const visibleBottom = Math.min(pageRect.bottom, containerRect.bottom);
    const visibleLeft = Math.max(pageRect.left, containerRect.left);
    const visibleRight = Math.min(pageRect.right, containerRect.right);

    const visibleCenterY = (visibleTop + visibleBottom) / 2;
    const visibleCenterX = (visibleLeft + visibleRight) / 2;

    // Calculate the position as a percentage of the page dimensions
    const percentX = (visibleCenterX - pageRect.left) / pageRect.width;
    const percentY = (visibleCenterY - pageRect.top) / pageRect.height;

    // Apply new scroll position after DOM update
    setTimeout(() => {
      if (!containerRef.current) return;

      // Get the updated page element
      const updatedPageElement = containerRef.current.querySelector(
        `[data-page-number="${pageElement.getAttribute('data-page-number')}"]`,
      );
      if (!updatedPageElement) return;

      const updatedPageRect = updatedPageElement.getBoundingClientRect();
      const updatedContainerRect = containerRef.current.getBoundingClientRect();

      // Calculate the new center position
      const newCenterX = updatedPageRect.left + updatedPageRect.width * percentX;
      const newCenterY = updatedPageRect.top + updatedPageRect.height * percentY;

      // Calculate the scroll needed to center this point
      const scrollLeftNeeded =
        newCenterX - updatedContainerRect.left - updatedContainerRect.width / 2 + containerRef.current.scrollLeft;
      const scrollTopNeeded =
        newCenterY - updatedContainerRect.top - updatedContainerRect.height / 2 + containerRef.current.scrollTop;

      // Apply the scroll
      containerRef.current.scrollLeft = scrollLeftNeeded;
      containerRef.current.scrollTop = scrollTopNeeded;
    }, 100);
  }, [findVisiblePageElement, containerRef]);

  return {
    findVisiblePageElement,
    handleScaleChange,
  };
};
