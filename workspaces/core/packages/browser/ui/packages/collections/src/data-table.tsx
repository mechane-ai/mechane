import * as stylex from '@stylexjs/stylex';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Checkbox } from '../../core/src/index.ts';
import { colors, conditions, controls, spacing, typography } from '../../core/src/tokens.stylex.ts';

const features = tableFeatures({});

const styles = stylex.create({
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
    'height': 39,
    'borderBottomWidth': 1,
    'borderBottomStyle': 'solid',
    'borderBottomColor': colors.line,
    ':hover': { backgroundColor: { [conditions.hoverPointer]: colors.canvas } },
  },
  selected: { backgroundColor: colors.accentSoft },
  cell: { paddingBlock: spacing.sm, paddingInline: spacing.lg, verticalAlign: 'middle', overflowWrap: 'anywhere' },
  start: { textAlign: 'start' },
  end: { textAlign: 'end' },
  width: (width: number) => ({ width }),
  selection: { width: 44, paddingInline: spacing.lg },
  spacer: (height: number) => ({ height, padding: 0, borderWidth: 0 }),
  empty: { padding: spacing.xxl, textAlign: 'center', color: colors.muted },
  footer: { padding: spacing.lg, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: colors.line },
});

type ColumnAlignment = 'start' | 'end';

const alignmentStyles = { start: styles.start, end: styles.end } satisfies Record<ColumnAlignment, stylex.StyleXStyles>;

export type DataTableColumn<Row> = {
  readonly id: string;
  readonly label: string;
  readonly cell: (row: Row) => ReactNode;
  readonly align?: ColumnAlignment;
  readonly width?: number;
  readonly sortable?: boolean;
};

export type DataTableSort = { readonly columnId: string; readonly direction: 'ascending' | 'descending' };

export type DataTableWindow = { readonly height: number; readonly estimatedRowHeight?: number };

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
    readonly empty: string;
    readonly window?: DataTableWindow;
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
  window,
  footer,
}: DataTableProps<Row>): ReactNode {
  const model = useMemo(() => {
    const helper = createColumnHelper<typeof features, Row>();

    return helper.columns(columns.map((column) => helper.display({ id: column.id, header: column.label })));
  }, [columns]);

  const table = useTable({ features, columns: model, data: rows, getRowId });
  const viewport = useRef<HTMLDivElement>(null);
  const captionElement = useRef<HTMLTableCaptionElement>(null);
  const headerElement = useRef<HTMLTableSectionElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);
  const [focusedId, setFocusedId] = useState<string>();
  const focusedIndex = rows.findIndex((row) => getRowId(row) === focusedId);

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
  }, [window]);

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

  const columnCount = columns.length + (selectedIds === undefined ? 0 : 1);

  const trailingSpace =
    virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? headerHeight) + headerHeight;

  return (
    <div>
      <div
        ref={viewport}
        role="region"
        aria-label={caption}
        tabIndex={0}
        {...stylex.props(styles.viewport, window !== undefined && styles.virtual(window.height))}
      >
        <table aria-rowcount={window === undefined ? undefined : rows.length + 1} {...stylex.props(styles.table)}>
          <caption ref={captionElement} {...stylex.props(styles.caption)}>
            {caption}
          </caption>
          <thead ref={headerElement}>
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
                  aria-rowindex={window === undefined ? undefined : index + 2}
                  ref={window === undefined ? undefined : virtualizer.measureElement}
                  onFocus={() => setFocusedId(row.id)}
                  {...stylex.props(styles.row, selectedIds?.has(row.id) === true && styles.selected)}
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
                  {columns.map((column) => (
                    <td key={column.id} {...stylex.props(styles.cell, alignmentStyles[column.align ?? 'start'])}>
                      {column.cell(row.original)}
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
      </div>
      {footer !== undefined && <div {...stylex.props(styles.footer)}>{footer}</div>}
    </div>
  );
}
