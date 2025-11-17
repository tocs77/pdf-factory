import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  useReactTable,
  getSortedRowModel,
  getCoreRowModel,
  flexRender,
  InitialTableState,
  ColumnDef,
  Table,
  getExpandedRowModel,
} from '@tanstack/react-table';

import { classNames } from '@/shared/utils';

import { calcColumnSizes } from '../../lib/calcColumnSizes';
import classes from '../Table/Table.module.scss';
interface TableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  defaultSorted?: { id: string; desc: boolean };
  columnResizeHandler?: (id: string, width: number) => void;
  rowContextHandler?: (e: React.MouseEvent, id: string) => void;
  rowClickHandler?: (e: React.MouseEvent, id: string) => void;
  getRowId?: (originalRow: T) => string;

  initialState: InitialTableState;
  mobile?: boolean;
  constColumns?: (keyof T)[];
  textAlign?: 'left' | 'right' | 'center';
}

export const ExpandTable = <T extends { children?: T[] }>(props: TableProps<T>) => {
  const {
    columns,
    data,
    mobile,
    rowContextHandler,
    rowClickHandler,
    constColumns,
    getRowId,
    initialState = {},
    textAlign = 'center',
  } = props;
  const columnSizesRef = useRef<Record<string, number>>({});
  const [domNode, setDomNode] = useState<HTMLTableElement>();

  const onRefChange = useCallback((node: HTMLTableElement) => {
    setDomNode(node);
  }, []);

  const table = useReactTable({
    columns,
    data,
    initialState,
    getRowId: getRowId,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onChange',

    getSubRows: (row) => row.children, // return the children array as sub-rows
    getExpandedRowModel: getExpandedRowModel(),
  });
  const { getHeaderGroups, getFlatHeaders } = table;

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    recaclulateColumnSizes();
  }, [domNode]);

  const recaclulateColumnSizes = () => {
    if (!domNode) return;
    const totalWidth = domNode.getBoundingClientRect().width;

    const headers = getFlatHeaders();
    let updateSizes: { [key: string]: number } = {};
    for (let i = 0; i < headers.length; i++) {
      const header = headers[i];
      updateSizes[header.id] = header.getSize();
    }
    updateSizes = calcColumnSizes({
      totalWidth,
      columns: updateSizes,
      constCols: constColumns as string[],
      minColWidth: 30,
    });
    columnSizesRef.current = updateSizes;
  };

  const setColumnsVars = () => {
    const colSizes: { [key: string]: number } = {};

    for (const header in columnSizesRef.current) {
      colSizes[`--header-${header}-size`] = columnSizesRef.current[header];
      colSizes[`--col-${header}-size`] = columnSizesRef.current[header];
    }
    return colSizes;
  };

  //TODO check if no need setColumnsVars
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  const columnSizeVars = useMemo(() => {
    recaclulateColumnSizes();
    return setColumnsVars();
  }, [table.getState().columnSizingInfo, table.getState().columnSizing, domNode]);

  return (
    <table
      ref={onRefChange}
      className={classNames(classes.table, { [classes.mobile]: mobile })}
      style={{ ...columnSizeVars }}
      data-signature='table-wrapper'>
      <thead className={classes.tableHeader}>
        {getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => {
              return (
                <th
                  style={{
                    width: `calc(var(--header-${header?.id}-size) * 1px)`,
                  }}
                  className={classNames(classes.tableColumn, { [classes.sortable]: header.column.getCanSort() })}
                  key={header.id}
                  onClick={header.column.getToggleSortingHandler()}>
                  <div className={classes.headerCellContent}>
                    <span>{flexRender(header.column.columnDef.header, header.getContext())}</span>
                    <span>
                      {{
                        asc: (
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            width='16'
                            height='16'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            stroke-width='2'
                            stroke-linecap='round'
                            stroke-linejoin='round'>
                            <path d='M18 15L12 9L6 15' />
                          </svg>
                        ),
                        desc: (
                          <svg
                            xmlns='http://www.w3.org/2000/svg'
                            width='16'
                            height='16'
                            viewBox='0 0 24 24'
                            fill='none'
                            stroke='currentColor'
                            stroke-width='2'
                            stroke-linecap='round'
                            stroke-linejoin='round'>
                            <path d='M6 9L12 15L18 9' />
                          </svg>
                        ),
                      }[header.column.getIsSorted() as string] ?? null}
                    </span>
                  </div>

                  {header.column.getCanResize() ? (
                    <div
                      className={`${classes.resizer} ${header.column.getIsResizing() ? classes.isResizing : ''}`}
                      onMouseDown={header.getResizeHandler()}
                      onTouchStart={header.getResizeHandler()}
                    />
                  ) : (
                    ''
                  )}
                </th>
              );
            })}
          </tr>
        ))}
      </thead>
      {table.getState().columnSizingInfo.isResizingColumn ? (
        <MemoizedTableBody table={table} textAlign={textAlign} />
      ) : (
        <TableBody table={table} rowContextHandler={rowContextHandler} rowClickHandler={rowClickHandler} textAlign={textAlign} />
      )}
    </table>
  );
};

interface TableBodyProps<T> {
  table: Table<T>;
  rowContextHandler?: (e: React.MouseEvent, id: string) => void;
  rowClickHandler?: (e: React.MouseEvent, id: string) => void;
  textAlign: 'left' | 'right' | 'center';
}

export const TableBody = <T,>(props: TableBodyProps<T>) => {
  const { table, rowContextHandler, rowClickHandler, textAlign } = props;

  const contextHandler = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    if (rowContextHandler) rowContextHandler(e, id);
  };

  const clickHandler = (e: React.MouseEvent, id: string) => {
    if (rowClickHandler) rowClickHandler(e, id);
  };

  return (
    <tbody>
      {table.getRowModel().rows.map((row) => {
        return (
          <tr
            key={row.id}
            className={classes.table_row}
            onContextMenu={(e) => contextHandler(e, row.id)}
            onClick={(e) => clickHandler(e, row.id)}>
            {row.getVisibleCells().map((cell) => {
              return (
                <td
                  className={classes.table_cell}
                  key={cell.id}
                  // style={{ width: cell.column.getSize() }}
                  style={{
                    width: `calc(var(--col-${cell.column.id}-size) * 1px)`,
                    textAlign: textAlign,
                    fontWeight: row.depth === 0 ? 'bold' : 'normal',
                  }}
                >
                  <span className={classes.tableCellContent}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</span>
                </td>
              );
            })}
          </tr>
        );
      })}
    </tbody>
  );
};

export const MemoizedTableBody = memo(
  TableBody,
  (prev, next) => prev.table.options.data === next.table.options.data,
) as typeof TableBody;
