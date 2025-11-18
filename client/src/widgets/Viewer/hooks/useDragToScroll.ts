import { useState, useEffect, useRef } from 'react';
import { isSliderBeingDragged } from '../utils/dragControl/dragControl';

interface UseDragToScrollProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isEnabled: boolean;
  isMobile?: boolean;
}

export const useDragToScroll = ({ containerRef, isEnabled, isMobile = false }: UseDragToScrollProps): boolean => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const scrollStartXRef = useRef(0);
  const scrollStartYRef = useRef(0);
  const dragButtonRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;

    // Effect setup/cleanup logic based on isEnabled
    if (!container || !isEnabled) {
      if (container && (container.style.cursor === 'grab' || container.style.cursor === 'grabbing')) {
        container.style.cursor = 'default';
      }
      if (isDragging) {
        setIsDragging(false);
      }
      // No listener needed if not enabled
      return () => {};
    }

    // Set initial cursor if enabled and not currently dragging
    if (!isDragging) {
      container.style.cursor = 'grab';
    }

    const handleMouseDown = (e: MouseEvent) => {
      // Ensure the click originated within the container
      const targetElement = e.target as Node;
      if (!containerRef.current || !containerRef.current.contains(targetElement)) {
        // Click was outside the container, ignore
        return;
      }

      // Check if the event target or an ancestor should ignore drag-scroll
      if ((targetElement as HTMLElement).closest('[data-dragscroll-ignore="true"]')) {
        return; // Ignore drag initiation for specifically marked elements
      }

      // Check conditions again: enabled, left or middle button, no ctrl, not slider
      if (
        !isEnabled || // Check isEnabled flag again inside handler
        (e.button !== 0 && e.button !== 1) || // Allow left (0) or middle (1) mouse button
        e.ctrlKey ||
        isSliderBeingDragged() ||
        document.body.classList.contains('slider-dragging') ||
        document.body.classList.contains('resizingHorizontal')
      ) {
        return;
      }

      // Check target element classes specifically (redundant with closest check, but safe)
      if (
        (targetElement as HTMLElement).classList.contains('sliderHandle') ||
        (targetElement as HTMLElement).classList.contains('sliderLine') ||
        (targetElement as HTMLElement).closest('.sliderHandle')
      ) {
        return;
      }

      // If we get here, initiate drag
      dragStartXRef.current = e.clientX;
      dragStartYRef.current = e.clientY;
      dragButtonRef.current = e.button; // Store which button initiated the drag
      // Read scroll position directly from containerRef.current
      scrollStartXRef.current = containerRef.current.scrollLeft;
      scrollStartYRef.current = containerRef.current.scrollTop;

      setIsDragging(true);
      containerRef.current.style.cursor = 'grabbing';
      e.preventDefault(); // Prevent text selection during drag

      // Define move/up handlers inside mousedown to capture current state
      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Check if container still exists before scrolling
        if (!containerRef.current) return;
        const deltaX = moveEvent.clientX - dragStartXRef.current;
        const deltaY = moveEvent.clientY - dragStartYRef.current;
        containerRef.current.scrollLeft = scrollStartXRef.current - deltaX;
        containerRef.current.scrollTop = scrollStartYRef.current - deltaY;
        moveEvent.preventDefault();
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        // Only handle mouseup for the button that initiated the drag
        if (upEvent.button !== dragButtonRef.current) return;

        setIsDragging(false);
        dragButtonRef.current = null; // Reset the button ref
        // Set cursor back to grab only if the hook is still enabled and container exists
        if (isEnabled && containerRef.current) {
          containerRef.current.style.cursor = 'grab';
        }

        document.removeEventListener('mousemove', handleMouseMove, true);
        document.removeEventListener('mouseup', handleMouseUp, true);
      };

      // Use capture phase for move/up as well for consistency
      document.addEventListener('mousemove', handleMouseMove, { capture: true });
      document.addEventListener('mouseup', handleMouseUp, { capture: true });
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (!isMobile) return;

      // Ensure the touch originated within the container
      const targetElement = e.target as Node;
      if (!containerRef.current || !containerRef.current.contains(targetElement)) {
        return;
      }

      // Check if the event target or an ancestor should ignore drag-scroll
      if ((targetElement as HTMLElement).closest('[data-dragscroll-ignore="true"]')) {
        return;
      }

      // Check conditions: enabled, not slider being dragged
      if (
        !isEnabled ||
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

      setIsDragging(true);
      e.preventDefault(); // Prevent default touch behavior

      const handleTouchMove = (moveEvent: TouchEvent) => {
        if (!containerRef.current || moveEvent.touches.length !== 1) return;

        const touch = moveEvent.touches[0];
        const deltaX = touch.clientX - dragStartXRef.current;
        const deltaY = touch.clientY - dragStartYRef.current;
        containerRef.current.scrollLeft = scrollStartXRef.current - deltaX;
        containerRef.current.scrollTop = scrollStartYRef.current - deltaY;
        moveEvent.preventDefault();
      };

      const handleTouchEnd = () => {
        setIsDragging(false);

        document.removeEventListener('touchmove', handleTouchMove, true);
        document.removeEventListener('touchend', handleTouchEnd, true);
      };

      document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: false });
      document.addEventListener('touchend', handleTouchEnd, { capture: true });
    };

    // Add listeners to document in capture phase
    document.addEventListener('mousedown', handleMouseDown, { capture: true });
    if (isMobile) {
      document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: false });
    }

    // Cleanup function
    return () => {
      // Remove listeners from document
      document.removeEventListener('mousedown', handleMouseDown, { capture: true });
      if (isMobile) {
        document.removeEventListener('touchstart', handleTouchStart, { capture: true });
      }

      // Reset cursor on cleanup only if it was potentially set by this hook and container still exists
      if (
        containerRef.current &&
        (containerRef.current.style.cursor === 'grab' || containerRef.current.style.cursor === 'grabbing')
      ) {
        containerRef.current.style.cursor = 'default';
      }
      // Note: mousemove/mouseup and touchmove/touchend listeners are cleaned up internally by their handlers
    };
  }, [containerRef, isEnabled, isDragging, isMobile]); // isDragging needed to reset cursor correctly

  return isDragging;
};
