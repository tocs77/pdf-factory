import React, { useState, useRef, useCallback, useEffect, PropsWithChildren } from 'react';

import { Portal } from '@/shared/UI/Portal';

import styles from './DraggableDialog.module.scss';

type GrabAreaPosition = 'top' | 'bottom' | 'left' | 'right';

interface DraggableDialogProps {
  initialXPos?: number;
  initialYPos?: number;
  initialHeight?: number;
  initialWidth?: number;
  onClose?: () => void;
  title?: string;
  onPositionChange?: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
  resizable?: boolean;
  showHeader?: boolean;
  grabAreas?: GrabAreaPosition[];
}

type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

export const DraggableDialog = (props: PropsWithChildren<DraggableDialogProps>): React.ReactElement => {
  const {
    children,
    initialXPos = 100,
    initialYPos = 100,
    initialHeight,
    initialWidth,
    onClose,
    title = 'Dialog',
    onPositionChange,
    onSizeChange,
    resizable = true,
    showHeader = true,
    grabAreas = [],
  } = props;

  // Determine if we should auto-size (when not resizable and no initial dimensions provided)
  const shouldAutoSize = !resizable && (initialWidth === undefined || initialHeight === undefined);
  const [position, setPosition] = useState<Position>({ x: initialXPos, y: initialYPos });
  const [size, setSize] = useState<Size>({
    width: initialWidth ?? (shouldAutoSize ? 0 : 400),
    height: initialHeight ?? (shouldAutoSize ? 0 : 300),
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeHandle>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{ pos: Position; size: Size; originalPos: Position } | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);

  const getResizeCursor = useCallback((handle: ResizeHandle): string => {
    const cursors: Record<NonNullable<ResizeHandle>, string> = {
      n: 'n-resize',
      s: 's-resize',
      e: 'e-resize',
      w: 'w-resize',
      ne: 'ne-resize',
      nw: 'nw-resize',
      se: 'se-resize',
      sw: 'sw-resize',
    };
    return handle ? cursors[handle] : 'default';
  }, []);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, action: 'drag' | ResizeHandle) => {
      e.preventDefault();
      e.stopPropagation();

      const rect = dialogRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (action === 'drag') {
        setIsDragging(true);
        setDragOffset({
          x: e.clientX - position.x,
          y: e.clientY - position.y,
        });
      } else if (resizable) {
        setIsResizing(action);
        setResizeStart({
          pos: { x: e.clientX, y: e.clientY },
          size: { width: size.width, height: size.height },
          originalPos: { x: position.x, y: position.y },
        });
      } else {
        // If not resizable, don't handle resize actions
        return;
      }

      // Prevent text selection during drag/resize
      document.body.style.userSelect = 'none';
      document.body.style.cursor = action === 'drag' ? 'grabbing' : getResizeCursor(action);
    },
    [position, size, resizable, getResizeCursor],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        const newPosition = {
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        };
        setPosition(newPosition);
        onPositionChange?.(newPosition);
      } else if (isResizing && resizeStart) {
        const deltaX = e.clientX - resizeStart.pos.x;
        const deltaY = e.clientY - resizeStart.pos.y;

        let newWidth = resizeStart.size.width;
        let newHeight = resizeStart.size.height;
        let newX = resizeStart.originalPos.x;
        let newY = resizeStart.originalPos.y;

        // Handle width changes
        if (isResizing.includes('e')) {
          // Resize from right edge - grow/shrink to the right (left edge stays fixed)
          newWidth = Math.max(200, resizeStart.size.width + deltaX);
        } else if (isResizing.includes('w')) {
          // Resize from left edge - grow/shrink to the left (right edge stays fixed)
          newWidth = Math.max(200, resizeStart.size.width - deltaX);
          newX = resizeStart.originalPos.x + (resizeStart.size.width - newWidth);
        }

        // Handle height changes
        if (isResizing.includes('s')) {
          // Resize from bottom edge - grow/shrink downward (top edge stays fixed)
          newHeight = Math.max(150, resizeStart.size.height + deltaY);
        } else if (isResizing.includes('n')) {
          // Resize from top edge - grow/shrink upward (bottom edge stays fixed)
          newHeight = Math.max(150, resizeStart.size.height - deltaY);
          newY = resizeStart.originalPos.y + (resizeStart.size.height - newHeight);
        }

        const newSize = { width: newWidth, height: newHeight };
        const newPosition = { x: newX, y: newY };

        setSize(newSize);
        setPosition(newPosition);
        onSizeChange?.(newSize);
        onPositionChange?.(newPosition);
      }
    },
    [isDragging, isResizing, dragOffset, resizeStart, onPositionChange, onSizeChange],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
    setResizeStart(null);
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
    return;
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  return (
    <Portal>
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${shouldAutoSize ? styles.autoSize : ''}`}
        style={{
          left: position.x,
          top: position.y,
          width: shouldAutoSize && size.width === 0 ? 'auto' : size.width,
          height: shouldAutoSize && size.height === 0 ? 'auto' : size.height,
        }}>
        {/* Header - conditionally rendered */}
        {showHeader && (
          <div className={styles.header} onMouseDown={(e) => handleMouseDown(e, 'drag')}>
            <span className={styles.title}>{title}</span>
            {onClose && (
              <button className={styles.closeButton} onClick={onClose} onMouseDown={(e) => e.stopPropagation()}>
                ×
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className={styles.content}>{children}</div>

        {/* Resize handles - only render if resizable */}
        {resizable && (
          <>
            <div className={`${styles.resizeHandle} ${styles.resizeN}`} onMouseDown={(e) => handleMouseDown(e, 'n')} />
            <div className={`${styles.resizeHandle} ${styles.resizeS}`} onMouseDown={(e) => handleMouseDown(e, 's')} />
            <div className={`${styles.resizeHandle} ${styles.resizeE}`} onMouseDown={(e) => handleMouseDown(e, 'e')} />
            <div className={`${styles.resizeHandle} ${styles.resizeW}`} onMouseDown={(e) => handleMouseDown(e, 'w')} />
            <div className={`${styles.resizeHandle} ${styles.resizeNE}`} onMouseDown={(e) => handleMouseDown(e, 'ne')} />
            <div className={`${styles.resizeHandle} ${styles.resizeNW}`} onMouseDown={(e) => handleMouseDown(e, 'nw')} />
            <div className={`${styles.resizeHandle} ${styles.resizeSE}`} onMouseDown={(e) => handleMouseDown(e, 'se')} />
            <div className={`${styles.resizeHandle} ${styles.resizeSW}`} onMouseDown={(e) => handleMouseDown(e, 'sw')} />
          </>
        )}

        {/* Grab areas for dragging */}
        {grabAreas.map((position) => (
          <div
            key={position}
            className={`${styles.grabArea} ${styles[`grabArea${position.charAt(0).toUpperCase() + position.slice(1)}`]}`}
            onMouseDown={(e) => handleMouseDown(e, 'drag')}
            title={`Drag from ${position}`}
          />
        ))}
      </div>
    </Portal>
  );
};
