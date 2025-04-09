import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { InitialTableState } from '@tanstack/react-table';

import { TableElement, TableProps } from '../Table/Table';

import classes from '../Table/Table.module.scss';

// Create a type that removes properties we'll manage internally
type OmittedProps = 'selectedRows' | 'rowClickHandler' | 'initialState';

// SelectableTable specific props
export interface SelectableTableProps<T> extends Omit<TableProps<T>, OmittedProps> {
  // Make initialState optional (it's required in TableProps)
  initialState?: InitialTableState;
  // Callback when selection changes
  onSelectionChange?: (selectedRows: Record<string, boolean>) => void;
  // Initial selection
  initialSelection?: Record<string, boolean>;
  // Allow multiple selection
  multiSelect?: boolean;
  // Enable drag selection
  enableDragSelect?: boolean;
  // Enable row drag and drop
  enableRowDnd?: boolean;
  // Callback when row is dropped to a new position
  onRowDrop?: (rowId: string, targetId: string) => void;
  // Class name for table wrapper
  className?: string;
}

export interface SelectableTableRef {
  getSelectedRows: () => Record<string, boolean>;
  setSelectedRows: (selection: Record<string, boolean>) => void;
  clearSelection: () => void;
  getSelectedRowsIds: () => string[];
}

export const SelectableTable = forwardRef<SelectableTableRef, SelectableTableProps<any>>((props, ref) => {
  const {
    data,
    getRowId,
    initialState,
    onSelectionChange,
    initialSelection = {},
    multiSelect = false,
    enableDragSelect = false,
    enableRowDnd = false,
    onRowDrop,
    className,
    ...restProps
  } = props;

  const [selectedRows, setSelectedRows] = useState<Record<string, boolean>>(initialSelection);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartRowId, setDragStartRowId] = useState<string | null>(null);
  // Row DnD state
  const [isDraggingRow, setIsDraggingRow] = useState(false);
  const [draggedRowId, setDraggedRowId] = useState<string | null>(null);
  const [dragOverRowId, setDragOverRowId] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [initialMousePosition, setInitialMousePosition] = useState({ x: 0, y: 0 });
  const [showGhost, setShowGhost] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const dragGhostRef = useRef<HTMLDivElement>(null);

  // Get all row IDs
  const getAllRowIds = useCallback(() => {
    if (!data || !getRowId) return [];
    return data.map((row) => getRowId(row));
  }, [data, getRowId]);

  // Apply selection to a range of rows
  const selectRowRange = useCallback(
    (startId: string, endId: string, additive = false) => {
      const allIds = getAllRowIds();
      const startIndex = allIds.indexOf(startId);
      const endIndex = allIds.indexOf(endId);

      if (startIndex === -1 || endIndex === -1) return;

      const newSelection = additive ? { ...selectedRows } : {};

      const minIndex = Math.min(startIndex, endIndex);
      const maxIndex = Math.max(startIndex, endIndex);

      for (let i = minIndex; i <= maxIndex; i++) {
        newSelection[allIds[i]] = true;
      }

      setSelectedRows(newSelection);

      if (onSelectionChange) {
        onSelectionChange(newSelection);
      }
    },
    [getAllRowIds, selectedRows, onSelectionChange],
  );

  // Handle row click for selection
  const rowClickHandler = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();

      // Handle selection based on modifier keys and multiSelect setting
      if (multiSelect) {
        let newSelection: Record<string, boolean>;

        // Shift+click for range selection
        if (e.shiftKey && lastSelectedId) {
          selectRowRange(lastSelectedId, id, e.ctrlKey);
          return;
        }

        // Ctrl+click for toggling individual items
        if (e.ctrlKey) {
          newSelection = {
            ...selectedRows,
            [id]: !selectedRows[id],
          };
        } else {
          // Regular click (replace selection)
          newSelection = { [id]: true };
        }

        setSelectedRows(newSelection);
        setLastSelectedId(id);

        // Call the selection change callback if provided
        if (onSelectionChange) {
          onSelectionChange(newSelection);
        }
      } else {
        // Single selection mode
        const newSelection = selectedRows[id] ? {} : { [id]: true };
        setSelectedRows(newSelection);
        setLastSelectedId(id);

        if (onSelectionChange) {
          onSelectionChange(newSelection);
        }
      }
    },
    [selectedRows, multiSelect, onSelectionChange, lastSelectedId, selectRowRange],
  );

  // Handle mouse down event (start drag)
  const handleMouseDown = useCallback(
    (e: MouseEvent, rowId: string) => {
      if (!multiSelect || !enableDragSelect) return;

      // Only initiate drag with left mouse button
      if (e.button !== 0) return;

      // Don't start drag if using modifier keys
      if (e.shiftKey || e.ctrlKey) return;

      setDragStartRowId(rowId);
      setIsDragging(true);

      // Prevent text selection during drag
      e.preventDefault();
    },
    [multiSelect, enableDragSelect],
  );

  // Handle mouse move event (update drag selection)
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !dragStartRowId) return;

      // Find the element under the mouse cursor
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element) return;

      // Find the closest table row
      const row = element.closest('tr');
      if (!row) return;

      // Try to get the row ID from the data attribute
      const rowId = row.getAttribute('data-row-id');
      if (!rowId) return;

      selectRowRange(dragStartRowId, rowId, false);
    },
    [isDragging, dragStartRowId, selectRowRange],
  );

  // Handle mouse up event (end drag)
  const handleMouseUp = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);
    setDragStartRowId(null);
  }, [isDragging]);

  // Handle row drag start
  const handleRowDragStart = useCallback(
    (e: MouseEvent, rowId: string) => {
      if (!enableRowDnd) return;

      // Only initiate drag with left mouse button
      if (e.button !== 0) return;

      const initialPos = { x: e.clientX, y: e.clientY };
      setDraggedRowId(rowId);
      setIsDraggingRow(true);
      setInitialMousePosition(initialPos);
      setMousePosition(initialPos);
      setShowGhost(false);

      // Prevent text selection during drag
      e.preventDefault();
    },
    [enableRowDnd],
  );

  // Handle row drag over
  const handleRowDragOver = useCallback(
    (e: MouseEvent) => {
      if (!isDraggingRow || !draggedRowId) return;

      const currentPos = { x: e.clientX, y: e.clientY };
      // Update mouse position for the drag ghost
      setMousePosition(currentPos);

      // Calculate distance from initial position
      const dx = currentPos.x - initialMousePosition.x;
      const dy = currentPos.y - initialMousePosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Only show ghost if dragged more than 5px from the starting point
      if (distance > 5 && !showGhost) {
        setShowGhost(true);
      }

      // Find the element under the mouse cursor
      const element = document.elementFromPoint(e.clientX, e.clientY);
      if (!element) return;

      // Find the closest table row
      const row = element.closest('tr');
      if (!row) return;

      // Try to get the row ID from the data attribute
      const rowId = row.getAttribute('data-row-id');
      if (!rowId) return;

      setDragOverRowId(rowId);
    },
    [isDraggingRow, draggedRowId, initialMousePosition, showGhost],
  );

  // Handle row drag end
  const handleRowDragEnd = useCallback(() => {
    if (!isDraggingRow || !draggedRowId) {
      setIsDraggingRow(false);
      setDraggedRowId(null);
      setDragOverRowId(null);
      setShowGhost(false);
      return;
    }

    // Only trigger drop if we actually moved the mouse enough to show the ghost
    if (showGhost && dragOverRowId && draggedRowId !== dragOverRowId && onRowDrop) {
      onRowDrop(draggedRowId, dragOverRowId);
    }

    setIsDraggingRow(false);
    setDraggedRowId(null);
    setDragOverRowId(null);
    setShowGhost(false);
  }, [isDraggingRow, draggedRowId, dragOverRowId, showGhost, onRowDrop]);

  // Add row IDs to table rows for drag selection and row DnD
  useEffect(() => {
    if (!tableRef.current || !getRowId || !data) return;

    // Allow a short delay for the table to render
    const timer = setTimeout(() => {
      const table = tableRef.current?.querySelector('table');
      if (!table) return;

      const rows = Array.from(table.querySelectorAll('tbody tr'));

      // Add data-row-id attributes to each row
      rows.forEach((row, index) => {
        if (index < data.length) {
          const rowId = getRowId(data[index]);
          row.setAttribute('data-row-id', rowId);

          // Add cursor style for drag enabled rows
          if (enableRowDnd) {
            (row as HTMLElement).style.cursor = 'grab';
          }
        }
      });
    }, 100);

    return () => clearTimeout(timer);
  }, [data, getRowId, enableRowDnd]);

  // Add event listeners for drag selection or row DnD
  useEffect(() => {
    if (!tableRef.current) return () => {};

    // We can't have both drag selection and row DnD enabled at the same time
    const isDragSelectActive = multiSelect && enableDragSelect && !enableRowDnd;
    const isRowDndActive = enableRowDnd;

    if (!isDragSelectActive && !isRowDndActive) return () => {};

    const handleTableMouseDown = (e: MouseEvent) => {
      // Find the target row
      const target = e.target as HTMLElement;
      const row = target.closest('tr');
      if (!row) return;

      const rowId = row.getAttribute('data-row-id');
      if (!rowId) return;

      if (isDragSelectActive) {
        handleMouseDown(e, rowId);
      } else if (isRowDndActive) {
        handleRowDragStart(e, rowId);
      }
    };

    const handleTableMouseMove = (e: MouseEvent) => {
      if (isDragSelectActive && isDragging) {
        handleMouseMove(e);
      } else if (isRowDndActive && isDraggingRow) {
        handleRowDragOver(e);
      }
    };

    const table = tableRef.current.querySelector('table');
    if (table) {
      table.addEventListener('mousedown', handleTableMouseDown);
      table.addEventListener('mousemove', handleTableMouseMove);

      return () => {
        table.removeEventListener('mousedown', handleTableMouseDown);
        table.removeEventListener('mousemove', handleTableMouseMove);
      };
    }

    return () => {}; // Return empty cleanup function when table not found
  }, [
    multiSelect,
    enableDragSelect,
    enableRowDnd,
    isDragging,
    isDraggingRow,
    handleMouseDown,
    handleMouseMove,
    handleRowDragStart,
    handleRowDragOver,
  ]);

  // Add global mouse up listener for both drag selection and row DnD
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleMouseUp();
      }
      if (isDraggingRow) {
        handleRowDragEnd();
      }
    };

    if (enableDragSelect || enableRowDnd) {
      window.addEventListener('mouseup', handleGlobalMouseUp);

      return () => {
        window.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }

    return () => {}; // Empty cleanup function when neither drag select nor row DnD is enabled
  }, [enableDragSelect, enableRowDnd, isDragging, isDraggingRow, handleMouseUp, handleRowDragEnd]);

  // Style rows during dragging
  useEffect(() => {
    if (!tableRef.current || !enableRowDnd) return;

    const table = tableRef.current.querySelector('table');
    if (!table) return;

    const rows = Array.from(table.querySelectorAll('tbody tr'));

    rows.forEach((row) => {
      const rowId = row.getAttribute('data-row-id');
      const element = row as HTMLElement;

      // Reset styles
      element.style.opacity = '1';
      element.style.backgroundColor = '';

      // Apply styles based on drag state
      if (isDraggingRow) {
        if (rowId === draggedRowId) {
          element.style.opacity = '0.5';
        }
        if (rowId === dragOverRowId) {
          element.style.backgroundColor = 'var(--menu-background)';
        }
      }
    });
  }, [enableRowDnd, isDraggingRow, draggedRowId, dragOverRowId]);

  // Update drag ghost position during dragging
  useEffect(() => {
    if (!isDraggingRow || !showGhost || !dragGhostRef.current || !tableRef.current) return;

    const ghost = dragGhostRef.current;
    ghost.style.left = `${mousePosition.x + 15}px`; // Offset it slightly from cursor
    ghost.style.top = `${mousePosition.y + 15}px`;
    ghost.style.display = 'block';

    // Only create the ghost content on first render
    if (ghost.children.length === 0 && draggedRowId) {
      const table = tableRef.current.querySelector('table');
      if (table) {
        const originalRow = table.querySelector(`tr[data-row-id="${draggedRowId}"]`);
        if (originalRow) {
          // Create a table to hold our ghost row
          const ghostTable = document.createElement('table');
          ghostTable.style.width = '100%';
          ghostTable.style.borderCollapse = 'collapse';

          // Clone the row and its content
          const clonedRow = originalRow.cloneNode(true) as HTMLElement;

          // Get the original cells to match widths
          const originalCells = originalRow.querySelectorAll('td');
          const clonedCells = clonedRow.querySelectorAll('td');

          // Set the same width for each cell
          originalCells.forEach((cell, index) => {
            if (clonedCells[index]) {
              const width = window.getComputedStyle(cell).width;
              clonedCells[index].style.width = width;
              clonedCells[index].style.padding = '8px 12px';
              clonedCells[index].style.borderBottom = '1px solid rgba(0, 0, 0, 0.1)';
            }
          });

          // Add the cloned row to our ghost table
          ghostTable.appendChild(clonedRow);

          // Clear and append the new ghost content
          ghost.innerHTML = '';
          ghost.appendChild(ghostTable);
        }
      }
    }

    return () => {
      ghost.style.display = 'none';
      ghost.innerHTML = '';
    };
  }, [isDraggingRow, showGhost, mousePosition, draggedRowId]);

  // Expose methods to parent component
  useImperativeHandle(
    ref,
    () => ({
      getSelectedRows: () => selectedRows,
      getSelectedRowsIds: () => Object.keys(selectedRows).filter((id) => selectedRows[id]),
      setSelectedRows: (selection: Record<string, boolean>) => {
        setSelectedRows(selection);
        if (onSelectionChange) {
          onSelectionChange(selection);
        }
      },
      clearSelection: () => {
        setSelectedRows({});
        setLastSelectedId(null);
        if (onSelectionChange) {
          onSelectionChange({});
        }
      },
    }),
    [selectedRows, onSelectionChange],
  );

  return (
    <div
      ref={tableRef}
      className={className}
      onMouseUp={isDragging ? handleMouseUp : isDraggingRow ? handleRowDragEnd : undefined}
      style={{ userSelect: 'none', overflowY: 'hidden', height: '100%' }}>
      <TableElement
        data={data}
        getRowId={getRowId}
        initialState={initialState || {}}
        selectedRows={selectedRows}
        rowClickHandler={rowClickHandler}
        {...restProps}
      />
      <div ref={dragGhostRef} className={classes.dragGhost} />
    </div>
  );
});

SelectableTable.displayName = 'SelectableTable';
