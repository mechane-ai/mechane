import * as stylex from '@stylexjs/stylex';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Checkbox } from '../../forms/src/index.ts';
import { accessibility } from '../../foundations/src/accessibility.ts';
import {
  colors,
  conditions,
  controls,
  radii,
  spacing,
  tableGeometry,
  typography,
} from '../../foundations/src/tokens.stylex.ts';
import { Tooltip } from '../../overlays/src/index.ts';
import { useEndReached } from './use-end-reached.ts';

const features = tableFeatures({});

const rowControlSelector =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="textbox"], [role="tab"], [role^="menuitem"], [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

const rowFocusOffsets: ReadonlyMap<string, number> = new Map([
  ['ArrowUp', -1],
  ['ArrowDown', 1],
]);

const styles = stylex.create({
  frame: {
    minWidth: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
    color: colors.ink,
    WebkitFontSmoothing: 'antialiased',
  },
  content: {},
  fillFrame: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  viewport: {
    'minWidth': 0,
    'overflow': 'auto',
    'overscrollBehavior': 'contain',
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: -2,
    },
  },
  fillViewport: { flex: 1, minHeight: 0 },
  virtual: (height: number) => ({ maxHeight: height }),
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'left',
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  fixed: { tableLayout: 'fixed' },
  minimumWidth: (width: number, compactWidth: number) => ({
    minWidth: { default: width, [conditions.compactTable]: compactWidth },
  }),
  caption: {
    textAlign: 'left',
    padding: spacing.lg,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  header: {
    boxSizing: 'border-box',
    position: 'sticky',
    top: 0,
    zIndex: 1,
    height: tableGeometry.headerHeight,
    paddingBlock: 0,
    paddingInline: spacing.lg,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    color: colors.muted,
    backgroundColor: colors.surface,
    fontWeight: typography.regularWeight,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    whiteSpace: 'nowrap',
  },
  headerLabel: { display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  sort: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'gap': spacing.sm,
    'maxWidth': '100%',
    'minWidth': 0,
    'minHeight': {
      default: `calc(${tableGeometry.headerHeight}px - 1px)`,
      [conditions.coarsePointer]: controls.coarseTarget,
    },
    'padding': 0,
    'borderWidth': 0,
    'color': 'inherit',
    'backgroundColor': 'transparent',
    'fontFamily': 'inherit',
    'fontSize': 'inherit',
    'fontWeight': 'inherit',
    'lineHeight': 'inherit',
    'cursor': 'pointer',
    ':hover': { color: { [conditions.hoverPointer]: colors.ink } },
    ':active': { backgroundColor: colors.canvas },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  sortIcon: { flexShrink: 0 },
  row: {
    'height': tableGeometry.rowHeight,
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    ':hover:not(:active)': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
    ':last-child': { borderBottomWidth: 0 },
  },
  selected: { backgroundColor: colors.accentSoft },
  actionable: { 'cursor': 'pointer', ':active': { backgroundColor: colors.line } },
  trigger: {
    'WebkitUserSelect': 'text',
    'userSelect': 'text',
    'display': 'flex',
    'alignItems': 'center',
    'width': '100%',
    'minWidth': 0,
    'minHeight': { default: controls.smHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'padding': 0,
    'borderWidth': 0,
    'borderRadius': radii.sm,
    'color': 'inherit',
    'backgroundColor': 'transparent',
    'fontFamily': 'inherit',
    'fontSize': 'inherit',
    'fontWeight': 'inherit',
    'lineHeight': 'inherit',
    'textAlign': 'inherit',
    'textDecoration': 'none',
    'cursor': 'pointer',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  cell: {
    minWidth: '12ch',
    paddingBlock: 0,
    paddingInline: spacing.lg,
    verticalAlign: 'middle',
    overflowWrap: 'anywhere',
  },
  start: { textAlign: 'start' },
  end: { textAlign: 'end' },
  width: (width: number) => ({ width, minWidth: width }),
  secondary: { display: { [conditions.compactTable]: 'none' } },
  truncated: { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  cellContent: { display: 'block', minWidth: 0, maxWidth: '100%' },
  text: { display: 'block', minWidth: 0, width: '100%' },
  textColumn: { flex: 1, minWidth: 0 },
  textRow: { display: 'flex', alignItems: 'center', gap: spacing.md, minWidth: 0, width: '100%' },
  leading: { display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  secondaryText: { color: colors.muted, fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
  cellViewport: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
    height: `calc(${tableGeometry.rowHeight}px - 1px)`,
  },
  fixedContent: { width: '100%', maxHeight: `calc(${tableGeometry.rowHeight}px - 1px)` },
  contentCell: { paddingBlock: spacing.sm },
  contentViewport: { height: 'auto' },
  selection: { width: 44, minWidth: 0, paddingInline: spacing.md },
  spacer: (height: number) => ({ height, padding: 0, borderWidth: 0 }),
  empty: { padding: spacing.xxl, textAlign: 'center', color: colors.muted },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: colors.line },
  endContent: {
    'minHeight': controls.coarseTarget,
    'padding': spacing.lg,
    'color': colors.muted,
    'fontSize': typography.captionSize,
    'lineHeight': typography.captionLineHeight,
    ':empty': { minHeight: 0, padding: 0 },
  },
});

type ColumnAlignment = 'start' | 'end';
type TableSizing = 'content' | 'fill';
type RowSizing = 'fixed' | 'content';

const cellSizingStyles = { fixed: styles.content, content: styles.contentCell } satisfies Record<
  RowSizing,
  stylex.StyleXStyles
>;

const alignmentStyles = { start: styles.start, end: styles.end } satisfies Record<ColumnAlignment, stylex.StyleXStyles>;

const frameStyles = { content: styles.content, fill: styles.fillFrame } satisfies Record<
  TableSizing,
  stylex.StyleXStyles
>;

const viewportStyles = { content: styles.content, fill: styles.fillViewport } satisfies Record<
  TableSizing,
  stylex.StyleXStyles
>;

export type DataTableColumn<Row> = {
  readonly id: string;
  readonly label: string;
  readonly cell: (row: Row) => ReactNode;
  readonly align?: ColumnAlignment;
  readonly width?: number;
  readonly secondary?: boolean;
  readonly truncate?: boolean;
  readonly sortable?: boolean;
};

export type DataTableTextProps = {
  readonly children: string;
  readonly secondary?: string | undefined;
  readonly leading?: ReactNode;
};

export function DataTableText({ children, secondary, leading }: DataTableTextProps): ReactNode {
  return (
    <span {...stylex.props(styles.textRow)}>
      {leading !== undefined && (
        <span aria-hidden {...stylex.props(styles.leading)}>
          {leading}
        </span>
      )}
      <span {...stylex.props(styles.textColumn)}>
        <span title={children} {...stylex.props(styles.text, styles.truncated)}>
          {children}
        </span>
        {secondary !== undefined && (
          <span title={secondary} {...stylex.props(styles.text, styles.truncated, styles.secondaryText)}>
            {secondary}
          </span>
        )}
      </span>
    </span>
  );
}

export type DataTableSort = { readonly columnId: string; readonly direction: 'ascending' | 'descending' };

export type DataTableWindow = { readonly height: number | 'fill'; readonly estimatedRowHeight?: number };

export type DataTableRowAction<Row> = { readonly label?: (row: Row) => string } & (
  | { readonly href: (row: Row) => string; readonly onActivate?: (row: Row) => void }
  | { readonly href?: never; readonly onActivate: (row: Row) => void }
);

type SortProperties<Row> =
  | {
      readonly columns: ReadonlyArray<DataTableColumn<Row>>;
      readonly sort: DataTableSort | undefined;
      readonly onSortChange: (sort: DataTableSort | undefined) => void;
    }
  | {
      readonly columns: ReadonlyArray<DataTableColumn<Row> & { readonly sortable?: false }>;
      readonly sort?: never;
      readonly onSortChange?: never;
    };

type SelectionProperties<Row> = {
  readonly selectedIds: ReadonlySet<string>;
  readonly onSelectionChange: (selectedIds: ReadonlySet<string>) => void;
  readonly selectionLabel: (row: Row) => string;
};

type OptionalSelection<Row> =
  | SelectionProperties<Row>
  | { readonly selectedIds?: never; readonly onSelectionChange?: never; readonly selectionLabel?: never };

export type DataTableProps<Row> = SortProperties<Row> &
  OptionalSelection<Row> & {
    readonly rows: ReadonlyArray<Row>;
    readonly getRowId: (row: Row) => string;
    readonly caption: string;
    readonly empty: ReactNode;
    readonly rowAction?: DataTableRowAction<Row>;
    readonly activeRowId?: string | undefined;
    readonly focusRowId?: string | undefined;
    readonly hideCaption?: boolean;
    readonly hideHeaders?: boolean;
    readonly rowSizing?: RowSizing;
    readonly window?: DataTableWindow;
    readonly endContent?: ReactNode;
    readonly onEndReached?: () => void;
    readonly footer?: ReactNode;
  };

export function DataTable<Row extends object>({
  rows,
  columns,
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
  hideCaption = false,
  hideHeaders = false,
  rowSizing = 'fixed',
  window,
  endContent,
  onEndReached,
  footer,
}: DataTableProps<Row>): ReactNode {
  const model = useMemo(() => {
    const helper = createColumnHelper<typeof features, Row>();

    return helper.columns(columns.map((column) => helper.display({ id: column.id, header: column.label })));
  }, [columns]);

  const table = useTable({ features, columns: model, data: rows, getRowId });
  const viewport = useRef<HTMLDivElement>(null);
  const endElement = useRef<HTMLDivElement>(null);
  const captionElement = useRef<HTMLTableCaptionElement>(null);
  const headerElement = useRef<HTMLTableSectionElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [focusedId, setFocusedId] = useState<string>();
  const pendingFocusId = useRef<string | undefined>(undefined);
  const restoredFocusId = useRef<string | undefined>(undefined);
  const focusedIndex = rows.findIndex((row) => getRowId(row) === focusedId);
  const actionColumnIndex = columns.findIndex((column) => column.secondary !== true);
  const sizing = typeof window?.height === 'string' ? window.height : 'content';

  useLayoutEffect(() => {
    if (focusRowId === undefined) {
      restoredFocusId.current = undefined;

      return;
    }

    if (restoredFocusId.current === focusRowId) {
      return;
    }

    const row = viewport.current?.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(focusRowId)}"] [data-row-action]`,
    );

    if (row === undefined || row === null) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      row.focus({ preventScroll: true });

      restoredFocusId.current = focusRowId;
    });

    return () => cancelAnimationFrame(frame);
  }, [rows, focusRowId]);

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

  const virtualizer = useVirtualizer({
    count: rows.length,
    enabled: window !== undefined,
    getScrollElement: () => viewport.current,
    getItemKey: (index) => {
      const row = rows[index];

      if (row === undefined) {
        throw new RangeError('The virtual row is outside the supplied table page.');
      }

      return getRowId(row);
    },
    estimateSize: () =>
      rowSizing === 'fixed' ? tableGeometry.rowHeight : (window?.estimatedRowHeight ?? tableGeometry.rowHeight),
    scrollMargin: headerHeight,
    scrollPaddingStart: headerHeight,
    overscan: 6,
    rangeExtractor: (range) => {
      const indices = defaultRangeExtractor(range);

      // Keep the focused row and its neighbors mounted so Tab can continue through a virtualized table.
      if (focusedIndex === -1) {
        return indices;
      }

      return [...new Set([...indices, focusedIndex - 1, focusedIndex, focusedIndex + 1])]
        .filter((index) => index >= 0 && index < rows.length)
        .toSorted((first, second) => first - second);
    },
  });

  const rendered =
    window === undefined
      ? table.getRowModel().rows.map((row, index) => ({ row, index, spacerHeight: 0 }))
      : virtualizer.getVirtualItems().flatMap((item, index, items) => {
          const row = table.getRowModel().rows[item.index];

          if (row === undefined) {
            return [];
          }

          return [{ row, index: item.index, spacerHeight: item.start - (items[index - 1]?.end ?? headerHeight) }];
        });

  // Row measurements can move a footer out of view before its intersection callback runs.
  const isAtEnd = window !== undefined && (rows.length === 0 || virtualizer.range?.endIndex === rows.length - 1);

  useEffect(() => {
    if (isAtEnd) {
      onEndReached?.();
    }
  }, [isAtEnd, onEndReached, rows.length]);

  useLayoutEffect(() => {
    if (pendingFocusId.current === undefined) {
      return;
    }

    const row = Array.from(viewport.current?.querySelectorAll<HTMLTableRowElement>('[data-row-id]') ?? []).find(
      (element) => element.dataset['rowId'] === pendingFocusId.current,
    );

    const trigger = row?.querySelector<HTMLElement>('[data-row-action]');

    if (trigger !== undefined && trigger !== null) {
      trigger.focus({ preventScroll: window !== undefined });

      pendingFocusId.current = undefined;
    }
  });

  function moveFocus(event: KeyboardEvent<HTMLElement>, index: number) {
    const command = event.metaKey || event.ctrlKey;
    const alternate = event.altKey || event.shiftKey;

    if (command || alternate) {
      return;
    }

    const offset = rowFocusOffsets.get(event.key);

    if (offset === undefined) {
      return;
    }

    event.preventDefault();

    const nextIndex = index + offset;
    const nextRow = rows[nextIndex];

    if (nextRow === undefined) {
      return;
    }

    pendingFocusId.current = getRowId(nextRow);

    setFocusedId(pendingFocusId.current);

    if (window !== undefined) {
      virtualizer.scrollToIndex(nextIndex, { align: 'auto' });
    }
  }

  const columnCount = columns.length + (selectedIds === undefined ? 0 : 1);
  const selectionWidth = selectedIds === undefined ? 0 : 44;
  const showFooter = footer !== undefined && footer !== null && typeof footer !== 'boolean';
  const minimumWidth = columns.reduce((total, column) => total + (column.width ?? 160), selectionWidth);

  const compactWidth = columns
    .filter((column) => column.secondary !== true)
    .reduce((total, column) => total + (column.width ?? 160), selectionWidth);

  const trailingSpace =
    virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? headerHeight) + headerHeight;

  return (
    <div {...stylex.props(styles.frame, frameStyles[sizing])}>
      <div
        ref={viewport}
        role="region"
        aria-label={caption}
        tabIndex={0}
        {...stylex.props(
          styles.viewport,
          viewportStyles[sizing],
          typeof window?.height === 'number' && styles.virtual(window.height),
        )}
      >
        <table
          aria-rowcount={window === undefined ? undefined : Math.max(1, rows.length) + 1}
          {...stylex.props(
            styles.table,
            (rowSizing === 'fixed' || columns.some((column) => column.truncate === true)) && styles.fixed,
            styles.minimumWidth(minimumWidth, compactWidth),
          )}
        >
          <caption ref={captionElement} {...stylex.props(styles.caption, hideCaption && accessibility.hidden)}>
            {caption}
          </caption>
          <colgroup>
            {selectedIds !== undefined && <col {...stylex.props(styles.selection)} />}
            {columns.map((column) => (
              <col
                key={column.id}
                {...stylex.props(
                  column.width !== undefined && styles.width(column.width),
                  column.secondary === true && styles.secondary,
                )}
              />
            ))}
          </colgroup>
          <thead ref={headerElement} {...stylex.props(hideHeaders && accessibility.hidden)}>
            <tr>
              {selectedIds !== undefined && (
                <th scope="col" {...stylex.props(styles.header, styles.selection)}>
                  <span {...stylex.props(accessibility.hidden)}>Select</span>
                </th>
              )}
              {columns.map((column) => {
                const direction = sort?.columnId === column.id ? sort.direction : undefined;

                return (
                  <th
                    key={column.id}
                    scope="col"
                    title={column.label}
                    aria-sort={direction}
                    {...stylex.props(
                      styles.header,
                      alignmentStyles[column.align ?? 'start'],
                      column.width !== undefined && styles.width(column.width),
                      column.secondary === true && styles.secondary,
                    )}
                  >
                    {column.sortable === true && onSortChange !== undefined ? (
                      <button
                        type="button"
                        {...stylex.props(styles.sort)}
                        onClick={() => {
                          if (direction === 'ascending') {
                            onSortChange({ columnId: column.id, direction: 'descending' });
                          } else if (direction === 'descending') {
                            onSortChange(undefined);
                          } else {
                            onSortChange({ columnId: column.id, direction: 'ascending' });
                          }
                        }}
                      >
                        <span {...stylex.props(styles.headerLabel)}>{column.label}</span>
                        {direction === 'ascending' ? (
                          <ArrowUp size={14} aria-hidden="true" {...stylex.props(styles.sortIcon)} />
                        ) : direction === 'descending' ? (
                          <ArrowDown size={14} aria-hidden="true" {...stylex.props(styles.sortIcon)} />
                        ) : (
                          <ArrowUpDown size={14} aria-hidden="true" {...stylex.props(styles.sortIcon)} />
                        )}
                      </button>
                    ) : (
                      <span {...stylex.props(styles.headerLabel)}>{column.label}</span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setFocusedId(undefined);
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
                  ref={window === undefined || rowSizing === 'fixed' ? undefined : virtualizer.measureElement}
                  onFocus={() => setFocusedId(row.id)}
                  onClick={(event) => {
                    if (rowAction === undefined || !isPlainActivation(event)) {
                      return;
                    }

                    if (event.target instanceof Element && event.target.closest(rowControlSelector) !== null) {
                      return;
                    }

                    const trigger = event.currentTarget.querySelector<HTMLElement>('[data-row-action]');

                    trigger?.focus({ preventScroll: true });
                    trigger?.click();
                  }}
                  {...stylex.props(
                    styles.row,
                    rowAction !== undefined && styles.actionable,
                    (selectedIds?.has(row.id) === true || activeRowId === row.id) && styles.selected,
                  )}
                >
                  {selectedIds !== undefined && (
                    <td {...stylex.props(styles.cell, styles.selection)}>
                      <Checkbox.Root
                        aria-label={selectionLabel(row.original)}
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);

                          if (checked) {
                            next.add(row.id);
                          } else {
                            next.delete(row.id);
                          }

                          onSelectionChange(next);
                        }}
                      >
                        <Checkbox.Indicator />
                      </Checkbox.Root>
                    </td>
                  )}
                  {columns.map((column, columnIndex) => (
                    <td
                      key={column.id}
                      {...stylex.props(
                        styles.cell,
                        cellSizingStyles[rowSizing],
                        alignmentStyles[column.align ?? 'start'],
                        column.width !== undefined && styles.width(column.width),
                        column.secondary === true && styles.secondary,
                      )}
                    >
                      {rowAction !== undefined && columnIndex === actionColumnIndex ? (
                        <RowTrigger
                          row={row.original}
                          action={rowAction}
                          active={activeRowId === row.id}
                          onKeyDown={(event) => moveFocus(event, index)}
                        >
                          <TableCellContent fixed={rowSizing === 'fixed'} truncate={column.truncate}>
                            {column.cell(row.original)}
                          </TableCellContent>
                        </RowTrigger>
                      ) : (
                        <TableCellContent fixed={rowSizing === 'fixed'} truncate={column.truncate}>
                          {column.cell(row.original)}
                        </TableCellContent>
                      )}
                    </td>
                  ))}
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
                <td colSpan={columnCount} {...stylex.props(styles.empty)}>
                  {empty}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div ref={endElement} {...stylex.props(endContent !== undefined && styles.endContent)}>
          {endContent}
        </div>
      </div>
      {showFooter && <div {...stylex.props(styles.footer)}>{footer}</div>}
    </div>
  );
}

function TableCellContent({
  fixed,
  truncate,
  children,
}: {
  readonly fixed: boolean;
  readonly truncate: boolean | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const isTruncated = typeof children === 'string' && (truncate ?? fixed);

  return (
    <span {...stylex.props(styles.cellViewport, !fixed && styles.contentViewport)}>
      <span
        title={typeof children === 'string' ? children : undefined}
        {...stylex.props(styles.cellContent, fixed && styles.fixedContent, isTruncated && styles.truncated)}
      >
        {children}
      </span>
    </span>
  );
}

function isPlainActivation(event: MouseEvent<HTMLElement>): boolean {
  if (event.defaultPrevented || event.button !== 0) {
    return false;
  }

  const command = event.metaKey || event.ctrlKey;
  const alternate = event.altKey || event.shiftKey;

  if (command || alternate) {
    return false;
  }

  return event.detail === 0 || event.currentTarget.ownerDocument.getSelection()?.isCollapsed !== false;
}

type RowTriggerProps<Row> = {
  readonly row: Row;
  readonly action: DataTableRowAction<Row>;
  readonly active: boolean;
  readonly children: ReactNode;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

function RowTrigger<Row>({ row, action, active, children, onKeyDown }: RowTriggerProps<Row>): ReactNode {
  const label = action.label?.(row);

  const trigger =
    action.href === undefined ? (
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        data-row-action
        onKeyDown={onKeyDown}
        onClick={(event) => {
          if (isPlainActivation(event)) {
            action.onActivate(row);
          }
        }}
        {...stylex.props(styles.trigger)}
      >
        {children}
      </button>
    ) : (
      <a
        href={action.href(row)}
        aria-label={label}
        data-row-action
        onKeyDown={onKeyDown}
        onClick={(event) => {
          if (action.onActivate !== undefined && isPlainActivation(event)) {
            event.preventDefault();
            action.onActivate(row);
          }
        }}
        {...stylex.props(styles.trigger)}
      >
        {children}
      </a>
    );

  if (label === undefined) {
    return trigger;
  }

  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={trigger} />
      <Tooltip.Portal>
        <Tooltip.Positioner side="top" align="start">
          <Tooltip.Popup>{label}</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
