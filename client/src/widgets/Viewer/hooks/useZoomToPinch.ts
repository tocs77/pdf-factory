import { useCallback, useEffect, useRef } from 'react';
import { usePinch } from '@use-gesture/react';

import { Action } from '../model/types/viewerSchema';

// Zoom configuration constants
const ZOOM_FINALIZE_DELAY_MS = 500; // Wait 500ms after last pinch event before finalizing
const MIN_ZOOM_SCALE = 0.5; // Minimum zoom level (50%)
const MAX_ZOOM_SCALE = 5; // Maximum zoom level (500%)
const ZOOM_TRANSITION_DURATION = '0.05s'; // CSS transition duration

interface UseZoomToPinchProps {
  scale: number;
  dispatch: React.Dispatch<Action>;
  containerRef: React.RefObject<HTMLDivElement>;
  isEnabled: boolean;
}

export const useZoomToPinch = ({ scale, dispatch, containerRef, isEnabled }: UseZoomToPinchProps) => {
  // Use ref to track scale without recreating event listeners
  const scaleRef = useRef(scale);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Add a lock to prevent concurrent zoom operations
  const isZoomingRef = useRef(false);

  // Ref to track the debounce timeout for pinch zooming end detection
  const zoomEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track cumulative CSS transform scale during zoom gesture
  const cumulativeTransformScaleRef = useRef<number>(1);
  const activeZoomPageRef = useRef<HTMLElement | null>(null);
  const zoomPinchPositionRef = useRef<{ x: number; y: number; percentX: number; percentY: number } | null>(null);

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
      const pinchPos = zoomPinchPositionRef.current;
      const container = containerRef.current;

      if (pageElement && pinchPos && container) {
        // Calculate final scale
        const baseScale = scaleRef.current;
        const finalScale = Math.max(MIN_ZOOM_SCALE, Math.min(MAX_ZOOM_SCALE, baseScale * cumulativeTransformScaleRef.current));
        const scaleRatio = finalScale / baseScale;

        // Get current page dimensions BEFORE removing transform
        const pageRectBeforeFinalize = pageElement.getBoundingClientRect();

        // Reset cumulative scale BEFORE applying new React scale
        // This prevents the next pinch event from seeing stale cumulative value
        cumulativeTransformScaleRef.current = 1;

        // Apply final scale to React state (triggers re-render)
        // Keep CSS transform active until React renders to prevent flash of old scale
        dispatch({ type: 'setScale', payload: finalScale });

        // Wait for React to render new scale, then remove CSS transform and adjust scroll
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            // React has rendered with new scale, but CSS transform is still active
            // Now remove CSS transform - this prevents flash of old scale
            pageElement.style.transition = '';
            pageElement.style.transform = '';
            pageElement.style.transformOrigin = '';

            // Get page position and dimensions IMMEDIATELY after removing transform
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
            const pointXInPage = effectivePageWidth * pinchPos.percentX;
            const pointYInPage = effectivePageHeight * pinchPos.percentY;

            // Calculate where this point currently is in viewport coordinates
            const currentPointX = finalPageRect.left + pointXInPage;
            const currentPointY = finalPageRect.top + pointYInPage;

            // Calculate where we want the point to be (original pinch position in viewport)
            const targetPointX = pinchPos.x;
            const targetPointY = pinchPos.y;

            // Calculate the difference
            const deltaX = currentPointX - targetPointX;
            const deltaY = currentPointY - targetPointY;

            // Apply scroll adjustment IMMEDIATELY - don't wait another frame
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
              dispatch({ type: 'setIsPinchZooming', payload: false });
              activeZoomPageRef.current = null;
              zoomPinchPositionRef.current = null;
              isZoomingRef.current = false;
            }
            // If new zoom already in progress, keep refs alive and don't set isPinchZooming to false
          });
        });
      } else {
        // No active zoom data, just mark as complete
        isFinalizingRef.current = false;
        dispatch({ type: 'setIsPinchZooming', payload: false });
        cumulativeTransformScaleRef.current = 1;
        activeZoomPageRef.current = null;
        zoomPinchPositionRef.current = null;
        isZoomingRef.current = false;
      }

      zoomEndTimeoutRef.current = null;
    }, ZOOM_FINALIZE_DELAY_MS);
  }, [dispatch, containerRef]);

  // Setup pinch gesture handling
  const bind = usePinch(
    ({ offset: [scale_offset], origin, event, memo, first }) => {
      if (!isEnabled || !containerRef.current) return memo;

      // Only block if finalization is in progress (to prevent race conditions)
      if (isFinalizingRef.current) {
        return memo;
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

      // Use the gesture library's scale_offset (relative scale from initial pinch)
      // origin provides the center point between fingers
      const currentCenter = { x: origin[0], y: origin[1] };

      // Get page element dimensions and position
      const pageRect = pageElement.getBoundingClientRect();

      // Calculate pinch center position relative to the page
      const pinchXRelativePage = currentCenter.x - pageRect.left;
      const pinchYRelativePage = currentCenter.y - pageRect.top;

      // Calculate pinch center position as a percentage of page dimensions
      const pinchXPercentPage = pinchXRelativePage / pageRect.width;
      const pinchYPercentPage = pinchYRelativePage / pageRect.height;

      // Store pinch center client coordinates
      const pinchClientX = currentCenter.x;
      const pinchClientY = currentCenter.y;

      // Handle pinch start/end detection
      if (first) {
        dispatch({ type: 'setIsPinchZooming', payload: true });
        isZoomingRef.current = true;
      }

      // Mark that pinch zooming is active (prevents expensive page re-renders)
      if (!isZoomingRef.current) {
        dispatch({ type: 'setIsPinchZooming', payload: true });
        isZoomingRef.current = true;
      }

      // Check if this is a continuation or new gesture
      const isSamePage = activeZoomPageRef.current === pageElement;
      const isNewGesture = !activeZoomPageRef.current || !isSamePage;

      if (isNewGesture) {
        // New zoom gesture on a different page OR first gesture ever
        activeZoomPageRef.current = pageElement;

        // Set transform origin once at start of zoom gesture
        const transformOriginX = (pinchXPercentPage * 100).toFixed(2);
        const transformOriginY = (pinchYPercentPage * 100).toFixed(2);
        pageElement.style.transformOrigin = `${transformOriginX}% ${transformOriginY}%`;

        // Reset cumulative scale for new gesture
        cumulativeTransformScaleRef.current = 1;
      }

      // Always update pinch position for accurate scroll adjustment during finalization
      zoomPinchPositionRef.current = {
        x: pinchClientX,
        y: pinchClientY,
        percentX: pinchXPercentPage,
        percentY: pinchYPercentPage,
      };

      // Initialize memo on first pinch gesture
      if (!memo) {
        memo = {
          initialScale: scaleRef.current,
        };
      }

      // scale_offset is relative to the initial pinch (starts at 1.0)
      // Convert to cumulative transform scale
      cumulativeTransformScaleRef.current = scale_offset;

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

      // Reset zoom end timer (will finalize when pinch ends)
      handleZoomEnd();

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
  };
};
