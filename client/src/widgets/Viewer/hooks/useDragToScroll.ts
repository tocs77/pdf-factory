import { useEffect, useRef, useCallback } from 'react';

import { isSliderBeingDragged } from '../utils/dragControl/dragControl';

interface UseDragToScrollProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isEnabled: boolean;
  isMobile?: boolean;
}

/**
 * Hook for drag-to-scroll functionality with optimized performance at high zoom levels.
 * Uses requestAnimationFrame throttling and direct DOM manipulation to avoid expensive re-renders.
 */
export const useDragToScroll = ({ containerRef, isEnabled, isMobile = false }: UseDragToScrollProps): boolean => {
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const scrollStartXRef = useRef(0);
  const scrollStartYRef = useRef(0);
  const dragButtonRef = useRef<number | null>(null);

  // Performance optimization: use refs for RAF-based scroll updates
  const rafIdRef = useRef<number | null>(null);
  const pendingScrollRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const isFirstMoveRef = useRef(true);

  // RAF-based scroll update function
  const applyPendingScroll = useCallback(() => {
    if (pendingScrollRef.current && containerRef.current) {
      containerRef.current.scrollLeft = pendingScrollRef.current.x;
      containerRef.current.scrollTop = pendingScrollRef.current.y;
    }
    rafIdRef.current = null;
    pendingScrollRef.current = null;
  }, [containerRef]);

  // Schedule scroll update - immediate on first move, RAF-throttled for subsequent moves
  const scheduleScroll = useCallback(
    (x: number, y: number) => {
      if (!containerRef.current) return;

      // Apply first move immediately for responsive feedback
      if (isFirstMoveRef.current) {
        containerRef.current.scrollLeft = x;
        containerRef.current.scrollTop = y;
        isFirstMoveRef.current = false;
        return;
      }

      // Use RAF throttling for subsequent moves (performance at high zoom)
      pendingScrollRef.current = { x, y };

      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(applyPendingScroll);
      }
    },
    [applyPendingScroll, containerRef],
  );

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  // Handle cursor styling when isEnabled changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (!isEnabled) {
      if (container.style.cursor === 'grab' || container.style.cursor === 'grabbing') {
        container.style.cursor = 'default';
      }
      return;
    }

    if (!isDraggingRef.current) {
      container.style.cursor = 'grab';
    }
  }, [containerRef, isEnabled]);

  // Main effect for drag event handling
  useEffect(() => {
    const container = containerRef.current;

    if (!container || !isEnabled) {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
      }
      return;
    }

    const handleMouseDown = (e: MouseEvent) => {
      const targetElement = e.target as Node;
      if (!containerRef.current || !containerRef.current.contains(targetElement)) {
        return;
      }

      if ((targetElement as HTMLElement).closest('[data-dragscroll-ignore="true"]')) {
        return;
      }

      if (
        (e.button !== 0 && e.button !== 1) ||
        e.ctrlKey ||
        isSliderBeingDragged() ||
        document.body.classList.contains('slider-dragging') ||
        document.body.classList.contains('resizingHorizontal')
      ) {
        return;
      }

      if (
        (targetElement as HTMLElement).classList.contains('sliderHandle') ||
        (targetElement as HTMLElement).classList.contains('sliderLine') ||
        (targetElement as HTMLElement).closest('.sliderHandle')
      ) {
        return;
      }

      // Initiate drag
      dragStartXRef.current = e.clientX;
      dragStartYRef.current = e.clientY;
      dragButtonRef.current = e.button;
      scrollStartXRef.current = containerRef.current.scrollLeft;
      scrollStartYRef.current = containerRef.current.scrollTop;
      isFirstMoveRef.current = true;
      isDraggingRef.current = true;

      containerRef.current.style.cursor = 'grabbing';
      e.preventDefault();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!containerRef.current) return;

        const deltaX = moveEvent.clientX - dragStartXRef.current;
        const deltaY = moveEvent.clientY - dragStartYRef.current;

        scheduleScroll(scrollStartXRef.current - deltaX, scrollStartYRef.current - deltaY);
        moveEvent.preventDefault();
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        if (upEvent.button !== dragButtonRef.current) return;

        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        pendingScrollRef.current = null;

        isDraggingRef.current = false;
        dragButtonRef.current = null;

        if (containerRef.current) {
          containerRef.current.style.cursor = isEnabled ? 'grab' : 'default';
        }

        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('mouseup', handleMouseUp, true);
      };

      document.addEventListener('mousemove', handleMouseMove, { capture: true });
      document.addEventListener('mouseup', handleMouseUp, { capture: true });
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!isMobile) return;

      const targetElement = e.target as Node;
      if (!containerRef.current || !containerRef.current.contains(targetElement)) {
        return;
      }

      if ((targetElement as HTMLElement).closest('[data-dragscroll-ignore="true"]')) {
        return;
      }

      if (
        isSliderBeingDragged() ||
        document.body.classList.contains('slider-dragging') ||
        document.body.classList.contains('resizingHorizontal') ||
        e.touches.length !== 1
      ) {
        return;
      }

      const touch = e.touches[0];
      dragStartXRef.current = touch.clientX;
      dragStartYRef.current = touch.clientY;
      scrollStartXRef.current = containerRef.current.scrollLeft;
      scrollStartYRef.current = containerRef.current.scrollTop;
      isFirstMoveRef.current = true;
      isDraggingRef.current = true;
      e.preventDefault();

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (!containerRef.current || moveEvent.touches.length !== 1) return;

        const touch = moveEvent.touches[0];
        const deltaX = touch.clientX - dragStartXRef.current;
        const deltaY = touch.clientY - dragStartYRef.current;

        scheduleScroll(scrollStartXRef.current - deltaX, scrollStartYRef.current - deltaY);
        moveEvent.preventDefault();
      };

      const handleTouchEnd = () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        pendingScrollRef.current = null;

        isDraggingRef.current = false;

        document.removeEventListener('touchmove', handleTouchMove, true);
        document.removeEventListener('touchend', handleTouchEnd, true);
      };

      document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
      document.addEventListener('touchend', handleTouchEnd, { capture: true });
    };

    document.addEventListener('mousedown', handleMouseDown, { capture: true });
    if (isMobile) {
      document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
    }

    return () => {
      document.removeEventListener('mousedown', handleMouseDown, { capture: true });
      if (isMobile) {
        document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      }

      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      if (
        containerRef.current &&
        (containerRef.current.style.cursor === 'grab' || containerRef.current.style.cursor === 'grabbing')
      ) {
        containerRef.current.style.cursor = 'default';
      }
    };
  }, [containerRef, isEnabled, isMobile, scheduleScroll]);

  return isDraggingRef.current;
};
