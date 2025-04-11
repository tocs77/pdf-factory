import { useState, useEffect, useRef } from 'react';
import { isSliderBeingDragged } from '@/shared/utils';

interface UseDragToScrollProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isEnabled: boolean;
}

export const useDragToScroll = ({ containerRef, isEnabled }: UseDragToScrollProps): boolean => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartXRef = useRef(0);
  const dragStartYRef = useRef(0);
  const scrollStartXRef = useRef(0);
  const scrollStartYRef = useRef(0);

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

      // Check conditions again: enabled, primary button, no ctrl, not slider
      if (
        !isEnabled || // Check isEnabled flag again inside handler
        e.button !== 0 ||
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
        if (upEvent.button !== 0) return;

        setIsDragging(false);
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

    // Add listener to document in capture phase
    document.addEventListener('mousedown', handleMouseDown, { capture: true });

    // Cleanup function
    return () => {
      // Remove listener from document
      document.removeEventListener('mousedown', handleMouseDown, { capture: true });

      // Reset cursor on cleanup only if it was potentially set by this hook and container still exists
      if (
        containerRef.current &&
        (containerRef.current.style.cursor === 'grab' || containerRef.current.style.cursor === 'grabbing')
      ) {
        containerRef.current.style.cursor = 'default';
      }
      // Note: mousemove/mouseup listeners are cleaned up internally by handleMouseUp
    };
  }, [containerRef, isEnabled, isDragging]); // isDragging needed to reset cursor correctly

  return isDragging;
};
