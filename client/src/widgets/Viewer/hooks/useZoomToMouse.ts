import { useCallback, useEffect } from 'react';
import { Action } from '../model/types/viewerSchema';

interface ZoomData {
  oldScale: number;
  newScale: number;
  mouseXDoc: number;
  mouseYDoc: number;
  scrollTopBefore: number;
  scrollLeftBefore: number;
  pageElement: HTMLElement;
  pageRect: DOMRect;
  mouseXPercentPage: number;
  mouseYPercentPage: number;
}

interface UseZoomToMouseProps {
  scale: number;
  dispatch: React.Dispatch<Action>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export const useZoomToMouse = ({ scale, dispatch, containerRef }: UseZoomToMouseProps) => {
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

  // Function to adjust scroll position after zoom, keeping the point under the cursor fixed
  const adjustScrollPositionAfterZoomOnPage = useCallback((container: HTMLDivElement, zoomData: ZoomData) => {
    const { pageElement, mouseXPercentPage, mouseYPercentPage, pageRect } = zoomData;

    // Get the updated page position and dimensions after scale change
    const updatedPageRect = pageElement.getBoundingClientRect();

    // Calculate the point's position on the page before zoom (as pixel values relative to page)
    const pointXOnPageBefore = pageRect.width * mouseXPercentPage;
    const pointYOnPageBefore = pageRect.height * mouseYPercentPage;

    // Calculate the same point's position after zoom (as pixel values relative to page)
    const pointXOnPageAfter = updatedPageRect.width * mouseXPercentPage;
    const pointYOnPageAfter = updatedPageRect.height * mouseYPercentPage;

    // Calculate how much the point "moved" due to scaling (in pixels)
    const deltaX = pointXOnPageAfter - pointXOnPageBefore;
    const deltaY = pointYOnPageAfter - pointYOnPageBefore;

    // Adjust scroll position by this delta to keep the point fixed under the cursor
    container.scrollLeft += deltaX;
    container.scrollTop += deltaY;
  }, []);

  // Prevent browser zoom on Ctrl+wheel globally
  useEffect(() => {
    // This function will prevent the default browser zoom behavior
    // AND handle our custom zoom functionality
    const preventBrowserZoom = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();

        // Get the container element
        const container = containerRef.current;
        if (!container) return false;

        // Check if the mouse is over a page element
        const target = e.target as HTMLElement;
        const pageElement = target.closest('[data-page-number]') as HTMLElement;

        // Only zoom if the mouse is over a page
        if (!pageElement) {
          return false;
        }

        // Get container dimensions and scroll position before zoom
        const containerRect = container.getBoundingClientRect();
        const scrollTopBefore = container.scrollTop;
        const scrollLeftBefore = container.scrollLeft;

        // Get page element dimensions and position
        const pageRect = pageElement.getBoundingClientRect();

        // Calculate mouse position relative to the page
        const mouseXRelativePage = e.clientX - pageRect.left;
        const mouseYRelativePage = e.clientY - pageRect.top;

        // Calculate mouse position as a percentage of page dimensions
        const mouseXPercentPage = mouseXRelativePage / pageRect.width;
        const mouseYPercentPage = mouseYRelativePage / pageRect.height;

        // Calculate mouse position relative to the document (including scroll)
        const mouseXDoc = e.clientX - containerRect.left + scrollLeftBefore;
        const mouseYDoc = e.clientY - containerRect.top + scrollTopBefore;

        // Handle our custom zoom functionality
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const oldScale = scale;
        const newScale = Math.max(0.5, Math.min(5, scale + delta));

        // Store the current scroll position and mouse position for use after the scale change
        const zoomData = {
          oldScale,
          newScale,
          mouseXDoc,
          mouseYDoc,
          scrollTopBefore,
          scrollLeftBefore,
          pageElement,
          pageRect,
          mouseXPercentPage,
          mouseYPercentPage,
        };

        // Update scale in context
        if (newScale !== scale) {
          // First update the scale
          dispatch({ type: 'setScale', payload: newScale });

          // Then adjust the scroll position in the next render cycle
          // Using multiple animation frames to ensure DOM has updated with new scale
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              adjustScrollPositionAfterZoomOnPage(container, zoomData);
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
  }, [scale, dispatch, adjustScrollPositionAfterZoomOnPage, containerRef]);

  // Prevent browser zoom shortcuts
  useEffect(() => {
    const preventBrowserZoomShortcuts = (e: KeyboardEvent) => {
      // Prevent browser zoom shortcuts (Ctrl+Plus, Ctrl+Minus, Ctrl+0)
      if (e.ctrlKey && (e.key === '+' || e.key === '-' || e.key === '=' || e.key === '_' || e.key === '0')) {
        e.preventDefault();
        e.stopPropagation();

        // Get the container element
        const container = containerRef.current;
        if (!container) return false;

        // Find the most visible page to focus on
        const visiblePage = findVisiblePageElement();
        if (!visiblePage) {
          return false;
        }

        const pageElement = visiblePage as HTMLElement;

        // Get container dimensions and scroll position before zoom
        const containerRect = container.getBoundingClientRect();
        const scrollTopBefore = container.scrollTop;
        const scrollLeftBefore = container.scrollLeft;

        // Get page element dimensions and position
        const pageRect = pageElement.getBoundingClientRect();

        // Calculate the viewport center
        const viewportCenterX = containerRect.left + containerRect.width / 2;
        const viewportCenterY = containerRect.top + containerRect.height / 2;

        // Calculate the position relative to the page
        const relativeX = Math.max(0, Math.min(1, (viewportCenterX - pageRect.left) / pageRect.width));
        const relativeY = Math.max(0, Math.min(1, (viewportCenterY - pageRect.top) / pageRect.height));

        // Use these relative positions instead of fixed 0.5
        const centerXPercentPage = relativeX;
        const centerYPercentPage = relativeY;

        // Calculate center position relative to the document (including scroll)
        const centerXDoc = viewportCenterX - containerRect.left + scrollLeftBefore;
        const centerYDoc = viewportCenterY - containerRect.top + scrollTopBefore;

        // Handle our custom zoom functionality for keyboard shortcuts
        let newScale = scale;
        if (e.key === '+' || e.key === '=') {
          // Zoom in
          newScale = Math.min(5, scale + 0.1);
        } else if (e.key === '-' || e.key === '_') {
          // Zoom out
          newScale = Math.max(0.5, scale - 0.1);
        } else if (e.key === '0') {
          // Reset zoom
          newScale = 1.5;
        }

        // Store the current scroll position and center position for use after the scale change
        const zoomData = {
          oldScale: scale,
          newScale,
          mouseXDoc: centerXDoc,
          mouseYDoc: centerYDoc,
          scrollTopBefore,
          scrollLeftBefore,
          pageElement,
          pageRect,
          mouseXPercentPage: centerXPercentPage,
          mouseYPercentPage: centerYPercentPage,
        };

        if (newScale !== scale) {
          // First update the scale
          dispatch({ type: 'setScale', payload: newScale });

          // Then adjust the scroll position in the next render cycle
          // Using multiple animation frames to ensure DOM has updated with new scale
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              adjustScrollPositionAfterZoomOnPage(container, zoomData);
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
  }, [scale, dispatch, findVisiblePageElement, adjustScrollPositionAfterZoomOnPage, containerRef]);

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
  }, [findVisiblePageElement, containerRef, scale]);

  return {
    findVisiblePageElement,
    adjustScrollPositionAfterZoomOnPage,
    handleScaleChange,
  };
};
