import { useCallback, useRef } from 'react';
import { usePinch } from '@use-gesture/react';

import { Action } from '../model/types/viewerSchema';

interface ZoomData {
  oldScale: number;
  newScale: number;
  pinchCenterXDoc: number;
  pinchCenterYDoc: number;
  scrollTopBefore: number;
  scrollLeftBefore: number;
  pageElement: HTMLElement;
  pageRect?: DOMRect;
  pinchCenterXPercentPage: number;
  pinchCenterYPercentPage: number;
  pinchCenterXViewport: number;
  pinchCenterYViewport: number;
}

interface UseZoomToPinchProps {
  scale: number;
  dispatch: React.Dispatch<Action>;
  containerRef: React.RefObject<HTMLDivElement>;
  isEnabled: boolean;
}

export const useZoomToPinch = ({ scale, dispatch, containerRef, isEnabled }: UseZoomToPinchProps) => {
  // Zoom speed configuration - increase for faster zoom, decrease for slower
  const ZOOM_SPEED = 3.0; // Adjust this value: 1.0 = normal, 2.0 = 2x faster, 0.5 = half speed

  // Use ref to always have the latest scale value (avoid stale closure)
  const currentScaleRef = useRef(scale);
  currentScaleRef.current = scale;

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

  // Function to adjust scroll position after zoom, keeping the pinch center fixed
  const adjustScrollPositionAfterZoomOnPage = useCallback((container: HTMLDivElement, zoomData: ZoomData) => {
    const { pinchCenterXViewport, pinchCenterYViewport, scrollTopBefore, scrollLeftBefore, oldScale, newScale } = zoomData;

    // Calculate how much the content scaled
    const scaleRatio = newScale / oldScale;

    // Calculate the pinch center position relative to the container
    const containerRect = container.getBoundingClientRect();
    const pinchCenterXRelativeContainer = pinchCenterXViewport - containerRect.left;
    const pinchCenterYRelativeContainer = pinchCenterYViewport - containerRect.top;

    // Calculate the document position that was under the pinch center before zoom
    const docXBeforeZoom = scrollLeftBefore + pinchCenterXRelativeContainer;
    const docYBeforeZoom = scrollTopBefore + pinchCenterYRelativeContainer;

    // After scaling, that same document position is now at a different location
    const docXAfterZoom = docXBeforeZoom * scaleRatio;
    const docYAfterZoom = docYBeforeZoom * scaleRatio;

    // Calculate the new scroll position needed to keep the pinch center fixed
    const newScrollLeft = docXAfterZoom - pinchCenterXRelativeContainer;
    const newScrollTop = docYAfterZoom - pinchCenterYRelativeContainer;

    // Apply the new scroll position
    container.scrollLeft = newScrollLeft;
    container.scrollTop = newScrollTop;
  }, []);

  // Setup pinch gesture handling
  const bind = usePinch(
    ({ offset: [scale_offset], origin, event, memo, first, last }) => {
      if (!isEnabled || !containerRef.current) return memo;

      const container = containerRef.current;

      // Handle pinch start/end detection
      if (first) {
        console.log(`🤏 [Pinch Zoom] Pinch started - setting isPinchZooming = true`);
        dispatch({ type: 'setIsPinchZooming', payload: true });
      }

      if (last) {
        console.log(`🤏 [Pinch Zoom] Pinch ended - setting isPinchZooming = false`);
        dispatch({ type: 'setIsPinchZooming', payload: false });
      }

      // Prevent default touch behavior during pinch
      if (event) {
        event.preventDefault();
      }

      // Check if the pinch is over a page element
      const target = event?.target as HTMLElement;
      const pageElement = target?.closest('[data-page-number]') as HTMLElement;

      // Only zoom if the pinch is over a page
      if (!pageElement) {
        return memo;
      }

      // Use the gesture library's scale_offset as our distance measure
      // origin provides the center point between fingers
      const currentDistance = Math.abs(scale_offset);
      const currentCenter = { x: origin[0], y: origin[1] };

      // Initialize memo on first pinch gesture
      if (!memo) {
        memo = {
          initialScale: currentScaleRef.current,
          currentScale: currentScaleRef.current, // Track current scale in memo
          initialDistance: currentDistance,
          lastDistance: currentDistance,
          accumulatedDelta: 0,
          pinchCenterXViewport: currentCenter.x,
          pinchCenterYViewport: currentCenter.y,
          scrollTopBefore: container.scrollTop,
          scrollLeftBefore: container.scrollLeft,
          pageElement,
        };

        return memo;
      }

      // Calculate distance delta since last frame
      const distanceDelta = currentDistance - memo.lastDistance;
      memo.lastDistance = currentDistance;

      // Accumulate the delta
      memo.accumulatedDelta += distanceDelta;

      // Apply zoom threshold (adjust this value to control sensitivity)
      const zoomThreshold = 0.1; // Lower threshold since scale_offset is normalized
      const zoomSensitivity = 0.3 * ZOOM_SPEED; // Use ZOOM_SPEED to control zoom rate

      console.log(`📊 [Pinch Zoom] Gesture analysis:`, {
        currentDistance: currentDistance.toFixed(3),
        distanceDelta: distanceDelta.toFixed(3),
        accumulatedDelta: memo.accumulatedDelta.toFixed(3),
        threshold: zoomThreshold,
        exceedsThreshold: Math.abs(memo.accumulatedDelta) > zoomThreshold,
        currentScale: memo.currentScale.toFixed(3),
        reactScale: currentScaleRef.current.toFixed(3),
        first,
        last,
      });

      // Check if accumulated delta exceeds threshold
      if (Math.abs(memo.accumulatedDelta) > zoomThreshold) {
        // Calculate scale change based on accumulated delta
        const scaleChange = memo.accumulatedDelta * zoomSensitivity;

        // Use the scale from memo (always current) instead of React state
        const currentScale = memo.currentScale;
        const newScale = Math.max(0.5, Math.min(5, currentScale + scaleChange));

        // Store the delta before resetting for logging
        const appliedDelta = memo.accumulatedDelta;

        // Reset accumulated delta after applying zoom
        memo.accumulatedDelta = 0;

        // Update the current scale in memo immediately
        memo.currentScale = newScale;

        // Store zoom data for scroll adjustment
        const zoomData = {
          oldScale: currentScale,
          newScale,
          pinchCenterXDoc: 0,
          pinchCenterYDoc: 0,
          scrollTopBefore: memo.scrollTopBefore,
          scrollLeftBefore: memo.scrollLeftBefore,
          pageElement: memo.pageElement,
          pageRect: undefined,
          pinchCenterXPercentPage: 0,
          pinchCenterYPercentPage: 0,
          pinchCenterXViewport: memo.pinchCenterXViewport,
          pinchCenterYViewport: memo.pinchCenterYViewport,
        };

        // Update scale
        console.log(`🔍 [Pinch Zoom] Dispatching scale change:`, {
          oldScale: currentScale.toFixed(3),
          newScale: newScale.toFixed(3),
          scaleChange: scaleChange.toFixed(3),
          accumulatedDelta: appliedDelta.toFixed(3),
          sensitivity: zoomSensitivity.toFixed(3),
          timestamp: Date.now(),
        });
        dispatch({ type: 'setScale', payload: newScale });

        // Adjust scroll position to keep pinch center fixed
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            adjustScrollPositionAfterZoomOnPage(container, zoomData);
          });
        });
      }

      return memo;
    },
    {
      // Configuration options for the pinch gesture
      scaleBounds: { min: 0.5, max: 5 },
      rubberband: true,
      preventDefault: true,
      enabled: isEnabled,
    },
  );

  return {
    bind,
    findVisiblePageElement,
    adjustScrollPositionAfterZoomOnPage,
  };
};
