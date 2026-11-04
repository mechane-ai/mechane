import * as stylex from '@stylexjs/stylex';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { Checkbox } from '../../forms/src/index.ts';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { colors, conditions, controls, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useEndReached } from './use-end-reached.ts';

const features = tableFeatures({});

const rowControlSelector =
  'a, button, input, select, textarea, label, summary, [role="button"], [role="link"], [role="switch"], [role="checkbox"], [role="radio"], [role="combobox"], [role="slider"], [role="spinbutton"], [role="textbox"], [role="tab"], [role^="menuitem"], [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

const rowFocusOffsets: ReadonlyMap<string, number> = new Map([
  ['ArrowUp', -1],
  ['ArrowDown', 1],
]);

const styles = stylex.create({
  frame: { minWidth: 0 },
  content: {},
  fillFrame: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  viewport: {
    'minWidth': 0,
    'overflow': 'auto',
    'overscrollBehavior': 'contain',
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
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'left',
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  fixed: { tableLayout: 'fixed' },
  minimumWidth: (width: number, compactWidth: number) => ({
    minWidth: { default: width, [conditions.compactTable]: compactWidth },
  }),
  caption: { textAlign: 'left', padding: spacing.lg, color: colors.muted, fontSize: typography.captionSize },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1,
    height: 36,
    paddingBlock: 0,
    paddingInline: spacing.lg,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    color: colors.muted,
    backgroundColor: colors.surface,
    fontWeight: 400,
    fontSize: typography.captionSize,
    whiteSpace: 'nowrap',
  },
  sort: {
    'display': 'inline-flex',
    'alignItems': 'center',
    'gap': spacing.sm,
    'minHeight': { default: controls.mdHeight, [conditions.coarsePointer]: controls.coarseTarget },
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
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineStyle: 'solid',
      outlineColor: colors.focus,
      outlineOffset: 2,
    },
  },
  row: {
    'height': { default: 39, [conditions.coarsePointer]: controls.coarseTarget },
    'borderTopWidth': 1,
    'borderTopStyle': 'solid',
    'borderTopColor': colors.line,
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
  },
  selected: { backgroundColor: colors.accentSoft },
  actionable: { cursor: 'pointer' },
  trigger: {
    'WebkitUserSelect': 'text',
    'userSelect': 'text',
    'display': 'block',
    'width': '100%',
    'minHeight': { default: controls.smHeight, [conditions.coarsePointer]: controls.coarseTarget },
    'padding': 0,
    'borderWidth': 0,
    'borderRadius': 2,
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
    paddingBlock: spacing.sm,
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
  selection: { width: 44, minWidth: 0, paddingInline: spacing.lg },
  spacer: (height: number) => ({ height, padding: 0, borderWidth: 0 }),
  empty: { padding: spacing.xxl, textAlign: 'center', color: colors.muted },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: colors.line },
  endContent: { minHeight: controls.coarseTarget, padding: spacing.lg },
});

type ColumnAlignment = 'start' | 'end';
type TableSizing = 'content' | 'fill';

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
    readonly activeRowId?: string;
    readonly hideCaption?: boolean;
    readonly hideHeaders?: boolean;
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
  hideCaption = false,
  hideHeaders = false,
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
  const focusedIndex = rows.findIndex((row) => getRowId(row) === focusedId);
  const actionColumnIndex = columns.findIndex((column) => column.secondary !== true);
  const sizing = typeof window?.height === 'string' ? window.height : 'content';

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
    estimateSize: () => window?.estimatedRowHeight ?? 44,
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
      ? table.getRowModel().rows.map((row, index) => ({ row, index, gap: 0 }))
      : virtualizer.getVirtualItems().flatMap((item, index, items) => {
          const row = table.getRowModel().rows[item.index];

          if (row === undefined) {
            return [];
          }

          return [{ row, index: item.index, gap: item.start - (items[index - 1]?.end ?? headerHeight) }];
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
            columns.some((column) => column.truncate === true) && styles.fixed,
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
                  Select
                </th>
              )}
              {columns.map((column) => {
                const direction = sort?.columnId === column.id ? sort.direction : undefined;

                return (
                  <th
                    key={column.id}
                    scope="col"
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
                        {column.label}
                        {direction === 'ascending' ? (
                          <ArrowUp size={14} aria-hidden="true" />
                        ) : direction === 'descending' ? (
                          <ArrowDown size={14} aria-hidden="true" />
                        ) : (
                          <ArrowUpDown size={14} aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      column.label
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
            {rendered.map(({ row, index, gap }) => (
              <Fragment key={row.id}>
                {gap > 0 && (
                  <tr aria-hidden="true">
                    <td colSpan={columnCount} {...stylex.props(styles.spacer(gap))} />
                  </tr>
                )}
                <tr
                  data-index={index}
                  data-row-id={row.id}
                  aria-rowindex={window === undefined ? undefined : index + 2}
                  ref={window === undefined ? undefined : virtualizer.measureElement}
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
                        alignmentStyles[column.align ?? 'start'],
                        column.width !== undefined && styles.width(column.width),
                        column.secondary === true && styles.secondary,
                        column.truncate === true && styles.truncated,
                      )}
                    >
                      {rowAction !== undefined && columnIndex === actionColumnIndex ? (
                        <RowTrigger
                          row={row.original}
                          action={rowAction}
                          active={activeRowId === row.id}
                          onKeyDown={(event) => moveFocus(event, index)}
                        >
                          <span {...stylex.props(styles.cellContent, column.truncate === true && styles.truncated)}>
                            {column.cell(row.original)}
                          </span>
                        </RowTrigger>
                      ) : (
                        <span {...stylex.props(styles.cellContent, column.truncate === true && styles.truncated)}>
                          {column.cell(row.original)}
                        </span>
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
      {footer !== undefined && <div {...stylex.props(styles.footer)}>{footer}</div>}
    </div>
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
  if (action.href !== undefined) {
    return (
      <a
        href={action.href(row)}
        aria-label={action.label?.(row)}
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
  }

  return (
    <button
      type="button"
      aria-label={action.label?.(row)}
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
  );
}
