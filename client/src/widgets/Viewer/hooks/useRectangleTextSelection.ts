import { useEffect, useRef, useState, useCallback, RefObject } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Rectangle {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Get text elements that intersect with a rectangle
 * Both rect and element positions are relative to the container
 */
const getElementsInRectangle = (container: HTMLElement, rect: Rectangle): HTMLElement[] => {
  const elements: HTMLElement[] = [];
  const containerRect = container.getBoundingClientRect();

  // rect is already in coordinates relative to the container
  // We need to compare with element positions also relative to the container
  const rectRight = rect.left + rect.width;
  const rectBottom = rect.top + rect.height;

  // Find all span elements in the container
  const allSpans = container.querySelectorAll('span');

  allSpans.forEach((node) => {
    const element = node as HTMLElement;

    // Get element position relative to container
    // Text spans are positioned absolutely within the container using left/top CSS properties
    const elementLeft = Number.parseFloat(element.style.left) || 0;
    const elementTop = Number.parseFloat(element.style.top) || 0;
    const elementWidth = Number.parseFloat(element.style.width) || element.offsetWidth;
    const elementHeight = Number.parseFloat(element.style.fontSize) || element.offsetHeight;

    // Also try getBoundingClientRect and convert to container-relative coordinates as fallback
    const elementRect = element.getBoundingClientRect();
    const elementLeftRel = elementRect.left - containerRect.left;
    const elementTopRel = elementRect.top - containerRect.top;
    const elementWidthRel = elementRect.width;
    const elementHeightRel = elementRect.height;

    // Use CSS position if available (more accurate), otherwise use computed position
    const finalLeft = !isNaN(elementLeft) && elementLeft > 0 ? elementLeft : elementLeftRel;
    const finalTop = !isNaN(elementTop) && elementTop > 0 ? elementTop : elementTopRel;
    const finalWidth = elementWidthRel > 0 ? elementWidthRel : elementWidth;
    const finalHeight = elementHeightRel > 0 ? elementHeightRel : elementHeight;

    const elementRight = finalLeft + finalWidth;
    const elementBottom = finalTop + finalHeight;

    // Check if element intersects with the rectangle (both in container-relative coordinates)
    const intersects = finalLeft < rectRight && elementRight > rect.left && finalTop < rectBottom && elementBottom > rect.top;

    if (intersects && element.textContent && element.textContent.trim() !== '') {
      elements.push(element);
    }
  });

  // Sort elements by their position (using container-relative coordinates)
  elements.sort((a, b) => {
    const aRect = a.getBoundingClientRect();
    const bRect = b.getBoundingClientRect();
    const aTop = aRect.top - containerRect.top;
    const bTop = bRect.top - containerRect.top;

    if (Math.abs(aTop - bTop) > 5) {
      return aTop - bTop;
    }
    const aLeft = aRect.left - containerRect.left;
    const bLeft = bRect.left - containerRect.left;
    return aLeft - bLeft;
  });

  return elements;
};

interface UseRectangleTextSelectionProps {
  mobile: boolean;
  textLayerRef: RefObject<HTMLDivElement>;
  drawingColor: string;
  viewport: any;
  drawingMode: string;
  onSelectionComplete: () => void;
  onHasSelectionChange: (hasSelection: boolean) => void;
}

export const useRectangleTextSelection = ({
  mobile,
  textLayerRef,
  drawingColor,
  viewport,
  drawingMode,
  onSelectionComplete,
  onHasSelectionChange,
}: UseRectangleTextSelectionProps) => {
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);

  const getTextLayerCoordinates = (clientX: number, clientY: number): Point => {
    if (!textLayerRef.current) return { x: 0, y: 0 };

    const rect = textLayerRef.current.getBoundingClientRect();
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const getRectangleFromPoints = (start: Point, end: Point): Rectangle => {
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const width = Math.abs(end.x - start.x);
    const height = Math.abs(end.y - start.y);

    return { left, top, width, height };
  };

  const clearCanvas = useCallback(() => {
    if (!selectionCanvasRef.current) return;

    const canvas = selectionCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const drawSelectionRect = () => {
    if (!selectionCanvasRef.current || !startPoint || !endPoint) return;

    const canvas = selectionCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    clearCanvas();

    ctx.strokeStyle = drawingColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);

    const rect = getRectangleFromPoints(startPoint, endPoint);
    ctx.beginPath();
    ctx.rect(rect.left, rect.top, rect.width, rect.height);
    ctx.stroke();
  };

  const createSelectionFromElements = (elements: HTMLElement[]) => {
    if (elements.length === 0) return;

    const selection = window.getSelection();
    if (!selection) return;

    // Clear any existing selection
    selection.removeAllRanges();

    try {
      // Create a range that spans from the first element to the last element
      const firstElement = elements[0];
      const lastElement = elements[elements.length - 1];

      const range = document.createRange();

      // Set start at the beginning of the first element's text content
      if (firstElement.firstChild) {
        range.setStart(firstElement.firstChild, 0);
      } else {
        range.setStartBefore(firstElement);
      }

      // Set end at the end of the last element's text content
      if (lastElement.lastChild && lastElement.lastChild.nodeType === Node.TEXT_NODE) {
        const textNode = lastElement.lastChild as Text;
        range.setEnd(textNode, textNode.length);
      } else if (lastElement.lastChild) {
        range.setEndAfter(lastElement.lastChild);
      } else {
        range.setEndAfter(lastElement);
      }

      selection.addRange(range);
    } catch (error) {
      // Fallback: try to select the entire text content
      console.warn('Failed to create selection from elements:', error);
    }
  };

  const beginSelection = (clientX: number, clientY: number) => {
    const point = getTextLayerCoordinates(clientX, clientY);
    setIsDrawing(true);
    setStartPoint(point);
    setEndPoint(point);
    onHasSelectionChange(false);

    // Clear browser selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  };

  const updateSelection = (clientX: number, clientY: number) => {
    if (!isDrawing || !startPoint) {
      return;
    }

    const point = getTextLayerCoordinates(clientX, clientY);
    setEndPoint(point);
    drawSelectionRect();
  };

  const finishSelection = () => {
    if (!isDrawing || !startPoint || !endPoint || !textLayerRef.current) {
      return;
    }

    setIsDrawing(false);

    const rect = getRectangleFromPoints(startPoint, endPoint);

    // Check if rectangle is too small
    if (rect.width < 10 || rect.height < 10) {
      resetSelection();
      return;
    }

    // Find text elements inside the rectangle
    const elements = getElementsInRectangle(textLayerRef.current, rect);

    if (elements.length > 0) {
      // Create browser Selection from elements so standard TextLayer functions can work with it
      createSelectionFromElements(elements);
      onHasSelectionChange(true);

      // Automatically create drawing if we're in a drawing mode (better UX for mobile)
      if (drawingMode === 'textUnderline' || drawingMode === 'textCrossedOut' || drawingMode === 'textHighlight') {
        // Use setTimeout to ensure selection is set before creating drawing
        setTimeout(() => {
          onSelectionComplete();
        }, 10);
      }
    } else {
      resetSelection();
    }
  };

  const resetSelection = useCallback(() => {
    setStartPoint(null);
    setEndPoint(null);
    setIsDrawing(false);
    clearCanvas();
    onHasSelectionChange(false);

    // Clear browser selection
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
  }, [clearCanvas, onHasSelectionChange]);

  // Setup canvas dimensions for mobile selection
  useEffect(() => {
    if (!mobile || !selectionCanvasRef.current || !textLayerRef.current) return;

    const canvas = selectionCanvasRef.current;
    const textLayer = textLayerRef.current;
    const rect = textLayer.getBoundingClientRect();

    canvas.width = rect.width;
    canvas.height = rect.height;
  }, [mobile, viewport]);

  // Event handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!mobile || e.button !== 0) return;
    beginSelection(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mobile) return;
    if (isDrawing) {
      updateSelection(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    if (!mobile) return;
    if (isDrawing) {
      finishSelection();
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!mobile || e.touches.length !== 1) return;
    const touch = e.touches[0];
    beginSelection(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!mobile || e.touches.length !== 1) return;
    const touch = e.touches[0];
    if (isDrawing) {
      updateSelection(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    if (!mobile) return;
    if (isDrawing) {
      finishSelection();
    }
  };

  return {
    selectionCanvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    resetSelection,
  };
};
