import * as stylex from '@stylexjs/stylex';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { Button as ButtonPrimitive } from '@ui-sdk/react/button';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { Checkbox } from '../../forms/src/index.ts';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { tableGeometry } from '../../foundations/src/constants.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { CollectionPagination } from './collection-controls.tsx';
import type { CollectionPaginationProps } from './collection-controls.tsx';
import {
  cellSizingStyles,
  ColumnGroup,
  columnRoleStyles,
  frameStyles,
  isCompactTable,
  prepareColumns,
  subscribeToCompactTable,
  TableCellContent,
  tableWidths,
  viewportStyles,
} from './data-table-layout.tsx';
import type { DataTableColumn, RowSizing } from './data-table-layout.tsx';
import { selectionColumnWidth, tableStyles as styles } from './data-table-styles.ts';
import { RowTrigger } from './data-table-trigger.tsx';
import type { DataTableRowAction } from './data-table-trigger.tsx';
import { useTableResults } from './table-results.tsx';
import type {
  DataTableSelectionDetails,
  DataTableSort,
  DataTableSortDetails,
  TableResultOptions,
  TableResultsApi,
  TableResultStatus,
} from './table-results.tsx';
import { useEndReached } from './use-end-reached.ts';
import { useTableWindow } from './use-table-window.ts';

const features = tableFeatures({});

const sortIcons = { ascending: ArrowUp, descending: ArrowDown, none: ArrowUpDown };

export type DataTableWindow = { readonly height: number | 'fill'; readonly estimatedRowHeight?: number };

type SortProperties<Row> =
  | {
      readonly columns: ReadonlyArray<DataTableColumn<Row>>;
      readonly sort: DataTableSort | undefined;
      readonly onSortChange: (sort: DataTableSort | undefined, details: DataTableSortDetails) => void;
    }
  | {
      readonly columns: ReadonlyArray<DataTableColumn<Row> & { readonly canSort?: false }>;
      readonly sort?: never;
      readonly onSortChange?: never;
    };

type SelectionProperties<Row> = {
  readonly selectedIds: ReadonlySet<string>;
  readonly onSelectionChange: (selectedIds: ReadonlySet<string>, details: DataTableSelectionDetails) => void;
  readonly selectionLabel: (row: Row) => string;
};

type OptionalSelection<Row> =
  | SelectionProperties<Row>
  | { readonly selectedIds?: never; readonly onSelectionChange?: never; readonly selectionLabel?: never };

type ReportedRowHighlight = { readonly id: string | undefined };

/** The row keyboard focus is on or was last on. The rows' one Tab stop stays there after focus leaves. */
type RowFocus = { readonly id: string; readonly isWithin: boolean };

export type TableRowsProps<Row> = SortProperties<Row> &
  OptionalSelection<Row> & {
    readonly rows: ReadonlyArray<Row>;
    readonly getRowId: (row: Row) => string;
    readonly caption: string;
    readonly empty: ReactNode;
    readonly filteredEmpty?: ReactNode;
    readonly rowAction?: DataTableRowAction<Row>;
    readonly activeRowId?: string | undefined;
    readonly focusRowId?: string | undefined;
    readonly onRowHighlightChange?: ((rowId: string | undefined) => void) | undefined;
    readonly hideCaption?: boolean;
    readonly hideHeaders?: boolean;
    readonly rowSizing?: RowSizing;
    readonly window?: DataTableWindow;
    readonly endContent?: ReactNode;
    readonly onEndReached?: () => void;
    readonly footer?: ReactNode;
    readonly pagination?: CollectionPaginationProps;
    readonly resultStatus?: TableResultStatus;
  };

/** Reports the row a mouse or the keyboard points at, once per change and after the render that changed it. */
function useRowHighlight(
  highlightedId: string | undefined,
  onRowHighlightChange: ((rowId: string | undefined) => void) | undefined,
): void {
  const reportedHighlight = useRef<ReportedRowHighlight | undefined>(undefined);

  useEffect(() => {
    if (onRowHighlightChange === undefined) {
      reportedHighlight.current = undefined;

      return;
    }

    if (reportedHighlight.current !== undefined && reportedHighlight.current.id === highlightedId) {
      return;
    }

    const delivery = { isCurrent: true };

    queueMicrotask(() => {
      if (!delivery.isCurrent) {
        return;
      }

      reportedHighlight.current = { id: highlightedId };

      onRowHighlightChange(highlightedId);
    });

    return () => {
      delivery.isCurrent = false;
    };
  }, [highlightedId, onRowHighlightChange]);
}

export function TableRows<Row extends object>({
  rows,
  columns: suppliedColumns,
  getRowId,
  caption,
  empty,
  sort,
  onSortChange,
  selectedIds,
  onSelectionChange,
  selectionLabel,
  rowAction,
  activeRowId,
  focusRowId,
  onRowHighlightChange,
  hideCaption = false,
  hideHeaders = false,
  rowSizing = 'fixed',
  window,
  endContent,
  onEndReached,
  footer,
  pagination,
  resultStatus = 'ready',
  isPlaceholder = false,
}: TableRowsProps<Row> & { isPlaceholder?: boolean }): ReactNode {
  const columns = useMemo(() => prepareColumns(suppliedColumns), [suppliedColumns]);
  const isCompact = useSyncExternalStore(subscribeToCompactTable, isCompactTable, () => false);

  const model = useMemo(() => {
    const helper = createColumnHelper<typeof features, Row>();

    return helper.columns(columns.map((column) => helper.display({ id: column.id, header: column.label })));
  }, [columns]);

  const table = useTable({ features, columns: model, data: rows, getRowId });
  const scroll = useScrollTabIndex<HTMLDivElement>();
  const viewport = scroll.viewport;
  const endElement = useRef<HTMLDivElement>(null);
  const captionElement = useRef<HTMLTableCaptionElement>(null);
  const headerElement = useRef<HTMLTableSectionElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [focus, setFocus] = useState<RowFocus>();
  const [hoveredId, setHoveredId] = useState<string>();
  const restoredFocusId = useRef<string | undefined>(undefined);
  const pendingOpenId = useRef<string | undefined>(undefined);
  const rowIds = useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const tabStopIndex = focus === undefined ? -1 : rowIds.indexOf(focus.id);
  const focusedIndex = focus?.isWithin === true ? tabStopIndex : -1;
  const validFocusedId = focusedIndex === -1 ? undefined : focus?.id;
  const primaryColumnIndex = columns.findIndex((column) => column.role === 'primary' && column.isSecondary !== true);

  const actionColumnIndex =
    primaryColumnIndex === -1 ? columns.findIndex((column) => column.isSecondary !== true) : primaryColumnIndex;

  const sizing = typeof window?.height === 'string' ? window.height : 'content';
  const isActionable = rowAction !== undefined && rowAction.disabled !== true;

  useEndReached({
    end: endElement,
    onEndReached: window === undefined ? onEndReached : undefined,
    content: rows.length,
  });

  useEffect(() => {
    const captionNode = captionElement.current;
    const header = headerElement.current;

    if (window === undefined || captionNode === null || header === null) {
      return;
    }

    const observer = new ResizeObserver(() => setHeaderHeight(captionNode.offsetHeight + header.offsetHeight));

    observer.observe(captionNode);
    observer.observe(header);

    return () => observer.disconnect();
  }, [window, hideCaption, hideHeaders]);

  const rowWindow = useTableWindow({
    isEnabled: window !== undefined,
    viewport,
    count: rows.length,
    keyOf: (index) => rowIds[index] ?? String(index),
    estimate: rowSizing === 'fixed' ? tableGeometry.rowHeight : (window?.estimatedRowHeight ?? tableGeometry.rowHeight),
    margin: headerHeight,
    // The Tab stop's row, and the focused row with its neighbors, stay rendered so Tab continues from them.
    keep: () => [Math.max(0, tabStopIndex), focusedIndex - 1, focusedIndex, focusedIndex + 1],
    onEnd: onEndReached,
  });

  // The window reports its end once per row count, and an empty window has no last row to reach.
  useEffect(() => {
    if (window !== undefined && rows.length === 0) {
      onEndReached?.();
    }
  }, [window, rows.length, onEndReached]);

  function findTrigger(id: string): HTMLElement | null {
    return viewport.current?.querySelector(`[data-row-id="${CSS.escape(id)}"] [data-row-action]`) ?? null;
  }

  const sortable = useMemo(
    () =>
      onSortChange === undefined
        ? []
        : columns.filter((column) => column.canSort === true).map(({ id, label }) => ({ id, label })),
    [columns, onSortChange],
  );

  const selected = useMemo(() => (selectedIds === undefined ? null : Array.from(selectedIds)), [selectedIds]);

  const resultOptions: TableResultOptions = {
    status: resultStatus,
    sort: sort ?? null,
    onSortChange: onSortChange === undefined ? undefined : (next, details) => onSortChange(next ?? undefined, details),
    sortable,
    selected,
    onSelectedChange:
      onSelectionChange === undefined ? undefined : (next, details) => onSelectionChange(new Set(next), details),
    pagination,
    rowIds,
    rowLabel: (index) => {
      const row = rows[index];

      return row === undefined ? undefined : (rowAction?.label?.(row) ?? selectionLabel?.(row));
    },
    isActionable,
    reveal: (index) => {
      if (window !== undefined) {
        rowWindow.scrollToIndex(index);
      }
    },
    onOpen: (index) => {
      const id = rowIds[index];
      const trigger = id === undefined ? null : findTrigger(id);

      if (trigger !== null) {
        trigger.click();

        return;
      }

      // A row the window has not rendered is pressed once the scroll has rendered it.
      pendingOpenId.current = id;

      rowWindow.scrollToIndex(index);
    },
    isPlaceholder,
  };

  useLayoutEffect(() => {
    const id = pendingOpenId.current;

    if (id === undefined) {
      return;
    }

    pendingOpenId.current = undefined;

    findTrigger(id)?.click();
  });

  const rendered =
    window === undefined
      ? table.getRowModel().rows.map((row, index) => ({ row, index, spacerHeight: 0 }))
      : rowWindow.items.flatMap((item, position, items) => {
          const row = table.getRowModel().rows[item.index];
          const previous = items[position - 1];

          if (row === undefined) {
            return [];
          }

          const previousEnd = previous === undefined ? 0 : previous.start + previous.size;

          return [{ row, index: item.index, spacerHeight: item.start - previousEnd }];
        });

  const validHoveredId = rendered.some(({ row }) => row.id === hoveredId) ? hoveredId : undefined;

  if (hoveredId !== undefined && validHoveredId === undefined) {
    setHoveredId(undefined);
  }

  useRowHighlight(validHoveredId ?? validFocusedId, onRowHighlightChange);

  const visibleColumnCount = columns.filter((column) => !isCompact || column.isSecondary !== true).length;
  const columnCount = visibleColumnCount + (selectedIds === undefined ? 0 : 1);
  const selectionWidth = selectedIds === undefined ? 0 : selectionColumnWidth;
  const showFooter = footer !== undefined && footer !== null && typeof footer !== 'boolean';
  const hasFooter = showFooter || pagination !== undefined;
  const { minimumWidth, compactWidth } = tableWidths(columns, selectionWidth);
  const lastItem = rowWindow.items.at(-1);
  const trailingSpace = rowWindow.size - (lastItem === undefined ? 0 : lastItem.start + lastItem.size);
  const selectedCount = selectedIds === undefined ? 0 : rowIds.filter((id) => selectedIds.has(id)).length;
  const isEverySelected = rowIds.length > 0 && selectedCount === rowIds.length;
  const isPartlySelected = selectedCount > 0 && !isEverySelected;

  function content(results: TableResultsApi): ReactNode {
    return (
      <>
        <caption
          ref={captionElement}
          aria-label={caption}
          {...stylex.props(styles.caption, hideCaption && accessibility.hidden)}
        >
          {caption}
        </caption>
        <ColumnGroup columns={columns} canSelect={selectedIds !== undefined} />
        <thead ref={headerElement} {...stylex.props(hideHeaders && accessibility.hidden)}>
          <tr>
            {selectedIds !== undefined && (
              <th scope="col" aria-label="Select" {...stylex.props(styles.header, styles.selection, styles.rowControl)}>
                <Checkbox.Root
                  aria-label={`Select every row of ${caption}`}
                  checked={isEverySelected}
                  indeterminate={isPartlySelected}
                  disabled={rowIds.length === 0}
                  onCheckedChange={(_, details) => results.toggleAll(details.event)}
                >
                  <Checkbox.Indicator />
                </Checkbox.Root>
              </th>
            )}
            {columns.map((column) => {
              const direction = sort?.columnId === column.id ? sort.direction : undefined;
              const SortIcon = sortIcons[direction ?? 'none'];

              return (
                <th
                  key={column.id}
                  scope="col"
                  title={column.label}
                  aria-sort={direction}
                  {...stylex.props(
                    styles.header,
                    columnRoleStyles[column.role],
                    column.width !== undefined && styles.width(column.width),
                    column.isSecondary === true && styles.secondary,
                  )}
                >
                  {column.canSort === true && onSortChange !== undefined ? (
                    <ButtonPrimitive
                      type="button"
                      aria-label={`Sort ${caption} by ${column.label}`}
                      {...stylex.props(styles.sort)}
                      onClick={(event) => results.toggleSort(column.id, event.nativeEvent)}
                    >
                      <span {...stylex.props(styles.headerLabel)}>{column.label}</span>
                      <SortIcon size={14} aria-hidden="true" {...stylex.props(styles.sortIcon)} />
                    </ButtonPrimitive>
                  ) : (
                    <span {...stylex.props(styles.headerLabel)}>{column.label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody
          onPointerLeave={() => setHoveredId(undefined)}
          onKeyDownCapture={() => setHoveredId(undefined)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setFocus((current) => (current === undefined ? undefined : { id: current.id, isWithin: false }));
            }
          }}
        >
          {rendered.map(({ row, index, spacerHeight }) => (
            <Fragment key={row.id}>
              {spacerHeight > 0 && (
                <tr aria-hidden="true">
                  <td colSpan={columnCount} {...stylex.props(styles.spacer(spacerHeight))} />
                </tr>
              )}
              <tr
                data-index={index}
                data-row-id={row.id}
                aria-rowindex={window === undefined ? undefined : index + 2}
                ref={window === undefined || rowSizing === 'fixed' ? undefined : rowWindow.measure(index)}
                onPointerMove={(event) => {
                  if (event.pointerType === 'mouse') {
                    setHoveredId(row.id);
                  }
                }}
                onPointerEnter={(event) => {
                  if (event.pointerType === 'mouse') {
                    setHoveredId(row.id);
                  }
                }}
                onPointerLeave={() => {
                  setHoveredId((current) => (current === row.id ? undefined : current));
                }}
                onPointerDown={(event) => {
                  if (event.pointerType !== 'mouse') {
                    setHoveredId(undefined);
                  }
                }}
                onFocus={() => {
                  setHoveredId(undefined);
                  setFocus({ id: row.id, isWithin: true });
                }}
                {...stylex.props(
                  styles.row,
                  isActionable && styles.actionable,
                  (selectedIds?.has(row.id) === true || activeRowId === row.id) && styles.selected,
                )}
              >
                {selectedIds !== undefined && (
                  <td {...stylex.props(styles.cell, styles.selection, styles.rowControl)}>
                    <Checkbox.Root
                      aria-label={selectionLabel(row.original)}
                      checked={selectedIds.has(row.id)}
                      onCheckedChange={(_, details) => results.toggleRow(row.id, details.event)}
                    >
                      <Checkbox.Indicator />
                    </Checkbox.Root>
                  </td>
                )}
                {columns.map((column, columnIndex) => {
                  const cell = (
                    <TableCellContent
                      role={column.role}
                      isFixed={rowSizing === 'fixed'}
                      shouldTruncate={column.shouldTruncate}
                    >
                      {column.cell(row.original)}
                    </TableCellContent>
                  );

                  return (
                    <td
                      key={column.id}
                      data-record-label={columnIndex === actionColumnIndex || undefined}
                      {...stylex.props(
                        styles.cell,
                        cellSizingStyles[rowSizing],
                        columnRoleStyles[column.role],
                        column.width !== undefined && styles.width(column.width),
                        column.isSecondary === true && styles.secondary,
                      )}
                    >
                      {rowAction !== undefined && columnIndex === actionColumnIndex ? (
                        <RowTrigger
                          index={index}
                          recordId={row.id}
                          row={row.original}
                          action={rowAction}
                          isActive={activeRowId === row.id}
                        >
                          {cell}
                        </RowTrigger>
                      ) : (
                        cell
                      )}
                    </td>
                  );
                })}
              </tr>
            </Fragment>
          ))}
          {window !== undefined && trailingSpace > 0 && (
            <tr aria-hidden="true">
              <td colSpan={columnCount} {...stylex.props(styles.spacer(trailingSpace))} />
            </tr>
          )}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columnCount} {...stylex.props(styles.emptyCell)}>
                <div {...stylex.props(styles.empty)}>{empty}</div>
              </td>
            </tr>
          )}
        </tbody>
      </>
    );
  }

  const { api, element: tableElement } = useTableResults(resultOptions, (results) => ({
    'aria-label': caption,
    'aria-busy': resultStatus === 'pending' || undefined,
    'aria-rowcount': window === undefined ? undefined : Math.max(1, rows.length) + 1,
    ...stylex.props(styles.table, styles.fixed, styles.minimumWidth(minimumWidth, compactWidth)),
    'children': content(results),
  }));

  useLayoutEffect(() => {
    if (focusRowId === undefined) {
      restoredFocusId.current = undefined;

      return;
    }

    const index = rowIds.indexOf(focusRowId);

    if (restoredFocusId.current === focusRowId || index === -1) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      if (api.focusRow(index)) {
        restoredFocusId.current = focusRowId;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [rowIds, focusRowId, isActionable, api]);

  return (
    <div {...stylex.props(styles.frame, frameStyles[sizing])}>
      <div
        ref={scroll.ref}
        data-table-viewport
        role="region"
        aria-label={caption}
        tabIndex={scroll.tabIndex}
        {...stylex.props(
          styles.viewport,
          viewportStyles[sizing],
          typeof window?.height === 'number' && styles.virtual(window.height),
        )}
      >
        {tableElement}
        {window !== undefined && <div aria-hidden {...stylex.props(styles.sizer(headerHeight + rowWindow.size))} />}
        <div ref={endElement} {...stylex.props(endContent !== undefined && styles.endContent)}>
          {endContent}
        </div>
      </div>
      {hasFooter && (
        <div {...stylex.props(styles.footer)}>
          {footer}
          {pagination !== undefined && <CollectionPagination {...pagination} label={caption} />}
        </div>
      )}
    </div>
  );
}
