import { useCallback, useEffect, useRef } from 'react';
import { Action } from '../model/types/viewerSchema';

interface ZoomData {
  oldScale: number;
  newScale: number;
  pageElement: HTMLElement;
  mouseXPercentPage: number;
  mouseYPercentPage: number;
  mouseClientX: number;
  mouseClientY: number;
}

interface UseZoomToMouseProps {
  scale: number;
  dispatch: React.Dispatch<Action>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const useZoomToMouse = ({ scale, dispatch, containerRef }: UseZoomToMouseProps) => {
  // Use ref to track scale without recreating event listeners
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // Add a lock to prevent concurrent zoom operations
  const isZoomingRef = useRef(false);

  // Ref to track the debounce timeout for wheel zooming end detection
  const zoomEndTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Set new timeout to mark zooming as complete after 300ms of no wheel events
    zoomEndTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'setIsWheelZooming', payload: false });
      zoomEndTimeoutRef.current = null;
    }, 300); // Reduced from 500ms to 300ms for faster high-quality render
  }, [dispatch]);

  // Function to adjust scroll position after zoom, keeping the point under the cursor fixed
  const adjustScrollPositionAfterZoomOnPage = useCallback((container: HTMLDivElement, zoomData: ZoomData) => {
    const { pageElement, mouseXPercentPage, mouseYPercentPage, mouseClientX, mouseClientY } = zoomData;

    // Get the updated page position and dimensions after scale change
    const updatedPageRect = pageElement.getBoundingClientRect();

    // Calculate where the point should be on the scaled page (in pixels from page's top-left)
    const pointXOnScaledPage = updatedPageRect.width * mouseXPercentPage;
    const pointYOnScaledPage = updatedPageRect.height * mouseYPercentPage;

    // Calculate where this point currently is in viewport coordinates
    const currentPointX = updatedPageRect.left + pointXOnScaledPage;
    const currentPointY = updatedPageRect.top + pointYOnScaledPage;

    // Calculate the offset from where we want it (mouse position)
    const deltaX = currentPointX - mouseClientX;
    const deltaY = currentPointY - mouseClientY;

    // Calculate maximum scroll limits
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const maxScrollTop = container.scrollHeight - container.clientHeight;

    // Calculate target scroll position and clamp to valid range
    const targetScrollLeft = container.scrollLeft + deltaX;
    const targetScrollTop = container.scrollTop + deltaY;

    const clampedScrollLeft = Math.max(0, Math.min(maxScrollLeft, targetScrollLeft));
    const clampedScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop));

    // Adjust scroll to eliminate this offset
    container.scrollLeft = clampedScrollLeft;
    container.scrollTop = clampedScrollTop;
  }, []);

  // Prevent browser zoom on Ctrl+wheel globally
  useEffect(() => {
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
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

        // Handle our custom zoom functionality
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const oldScale = scaleRef.current;
        const newScale = Math.max(0.5, Math.min(5, oldScale + delta));

        // Store the zoom data for use after the scale change
        const zoomData: ZoomData = {
          oldScale,
          newScale,
          pageElement,
          mouseXPercentPage,
          mouseYPercentPage,
          mouseClientX,
          mouseClientY,
        };

        // Update scale in context
        if (newScale !== oldScale) {
          // Mark that wheel zooming is active (prevents page re-renders)
          dispatch({ type: 'setIsWheelZooming', payload: true });

          // Set the lock to prevent concurrent zooms
          isZoomingRef.current = true;

          // First update the scale
          dispatch({ type: 'setScale', payload: newScale });

          // Then adjust the scroll position in the next render cycle
          // Need DOUBLE RAF: first for React state update, second for CSS to fully apply
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              adjustScrollPositionAfterZoomOnPage(container, zoomData);

              // Release the lock after scroll adjustment is complete
              isZoomingRef.current = false;

              // Start/reset the debounce timer for zoom end detection
              handleZoomEnd();
            });
          });
        }

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
  }, [dispatch, adjustScrollPositionAfterZoomOnPage, containerRef, handleZoomEnd]);

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

        // Store the zoom data for use after the scale change
        const zoomData: ZoomData = {
          oldScale,
          newScale,
          pageElement,
          mouseXPercentPage: centerXPercentPage,
          mouseYPercentPage: centerYPercentPage,
          mouseClientX: viewportCenterX,
          mouseClientY: viewportCenterY,
        };

        if (newScale !== oldScale) {
          // Mark that wheel zooming is active (prevents page re-renders)
          dispatch({ type: 'setIsWheelZooming', payload: true });

          // Set the lock to prevent concurrent zooms
          isZoomingRef.current = true;

          // First update the scale
          dispatch({ type: 'setScale', payload: newScale });

          // Then adjust the scroll position in the next render cycle
          // Need DOUBLE RAF: first for React state update, second for CSS to fully apply
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              adjustScrollPositionAfterZoomOnPage(container, zoomData);

              // Release the lock after scroll adjustment is complete
              isZoomingRef.current = false;

              // Start/reset the debounce timer for zoom end detection
              handleZoomEnd();
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
  }, [dispatch, findVisiblePageElement, adjustScrollPositionAfterZoomOnPage, containerRef, handleZoomEnd]);

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
    adjustScrollPositionAfterZoomOnPage,
    handleScaleChange,
  };
};
