import * as stylex from '@stylexjs/stylex';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Children, Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ComponentProps, KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { SkeletonText } from '../../feedback/src/index.ts';
import { Checkbox } from '../../forms/src/index.ts';
import { accessibility } from '../../foundations/src/accessibility.ts';
import { conditions, layers, tableGeometry } from '../../foundations/src/constants.stylex.ts';
import { colors, controls, pageGeometry, radii, spacing, typography } from '../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../foundations/src/use-scroll-tab-index.ts';
import { Tooltip } from '../../overlays/src/index.ts';
import { useEndReached } from './use-end-reached.ts';

const features = tableFeatures({});
const selectionColumnWidth = 76;
const compactTableQuery = conditions.compactTable.slice('@media '.length);

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
  placeholder: { pointerEvents: 'none' },
  fillFrame: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  viewport: {
    'minWidth': 0,
    'containerType': 'inline-size',
    'overflow': 'auto',
    'overscrollBehaviorY': 'auto',
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
    padding: pageGeometry.inset,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  header: {
    boxSizing: 'border-box',
    position: 'sticky',
    top: 0,
    zIndex: layers.sticky,
    height: tableGeometry.headerHeight,
    paddingBlock: 0,
    paddingInline: pageGeometry.inset,
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
    'position': 'relative',
    'isolation': 'isolate',
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
    'minHeight': { default: controls.height, [conditions.coarsePointer]: controls.coarseTarget },
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
    'outlineStyle': 'none',
    '::after': { content: '""', position: 'absolute', inset: 0 },
    ':focus-visible': {
      '::after': {
        outlineWidth: controls.focusWidth,
        outlineStyle: 'solid',
        outlineColor: colors.focus,
        outlineOffset: -2,
      },
    },
    ':disabled': { cursor: 'default', color: colors.muted },
  },
  cell: {
    boxSizing: 'border-box',
    paddingBlock: 0,
    paddingInline: pageGeometry.inset,
    verticalAlign: 'middle',
    overflowWrap: 'anywhere',
  },
  start: { textAlign: 'start' },
  end: { textAlign: 'end' },
  width: (width: number) => ({ width, minWidth: width }),
  secondary: { display: { [conditions.compactTable]: 'none' } },
  truncated: { overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  cellContent: {
    'display': 'block',
    'minWidth': 0,
    'width': '100%',
    'maxWidth': '100%',
    ':has(a, button, input, select, textarea, label, summary, [tabindex], [contenteditable])': {
      position: 'relative',
      zIndex: 1,
    },
  },
  rowControl: { position: 'relative', zIndex: 1 },
  text: { display: 'block', minWidth: 0, width: '100%' },
  textColumn: { flex: 1, minWidth: 0 },
  textRow: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 0,
    width: '100%',
    fontFamily: typography.fontFamily,
    fontSize: typography.bodySize,
    lineHeight: typography.bodyLineHeight,
    fontWeight: typography.regularWeight,
  },
  primaryRow: { display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 },
  primaryText: { width: 'auto', flexShrink: 1 },
  adornment: { display: 'inline-flex', alignItems: 'center', flexShrink: 0 },
  secondaryText: { color: colors.muted, fontSize: typography.captionSize, lineHeight: typography.captionLineHeight },
  cellViewport: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    width: '100%',
    height: `calc(${tableGeometry.rowHeight}px - 1px)`,
  },
  fixedContent: { maxHeight: `calc(${tableGeometry.rowHeight}px - 1px)` },
  readable: { whiteSpace: 'nowrap' },
  contentCell: { paddingBlock: spacing.sm },
  contentViewport: { height: 'auto' },
  selection: { width: selectionColumnWidth, minWidth: 0, paddingInline: pageGeometry.inset },
  spacer: (height: number) => ({ height, padding: 0, borderWidth: 0 }),
  emptyCell: { padding: 0 },
  empty: {
    boxSizing: 'border-box',
    position: 'sticky',
    insetInlineStart: 0,
    width: '100cqi',
    maxWidth: '100%',
    padding: spacing.xxl,
    textAlign: 'center',
    whiteSpace: 'normal',
    overflowWrap: 'anywhere',
    color: colors.muted,
  },
  footer: { padding: pageGeometry.inset, borderTopWidth: 1, borderTopStyle: 'solid', borderTopColor: colors.line },
  endContent: {
    'minHeight': controls.coarseTarget,
    'padding': pageGeometry.inset,
    'color': colors.muted,
    'fontSize': typography.captionSize,
    'lineHeight': typography.captionLineHeight,
    ':empty': { minHeight: 0, padding: 0 },
  },
});

type TableSizing = 'content' | 'fill';
type RowSizing = 'fixed' | 'content';

export type DataTableColumnRole = 'primary' | 'text' | 'status' | 'number' | 'timestamp' | 'actions';

type ColumnGeometry = { readonly minimumWidth: number; readonly isFlexible: boolean; readonly shouldTruncate: boolean };

const columnGeometry = {
  primary: { minimumWidth: 240, isFlexible: true, shouldTruncate: true },
  text: { minimumWidth: 160, isFlexible: false, shouldTruncate: true },
  status: { minimumWidth: 160, isFlexible: false, shouldTruncate: false },
  number: { minimumWidth: 112, isFlexible: false, shouldTruncate: false },
  timestamp: { minimumWidth: 160, isFlexible: false, shouldTruncate: false },
  actions: { minimumWidth: 112, isFlexible: false, shouldTruncate: false },
} satisfies Record<DataTableColumnRole, ColumnGeometry>;

const cellSizingStyles = { fixed: styles.content, content: styles.contentCell } satisfies Record<
  RowSizing,
  stylex.StyleXStyles
>;

const columnRoleStyles = {
  primary: styles.start,
  text: styles.start,
  status: styles.start,
  number: styles.end,
  timestamp: styles.end,
  actions: styles.end,
} satisfies Record<DataTableColumnRole, stylex.StyleXStyles>;

const frameStyles = { content: styles.content, fill: styles.fillFrame } satisfies Record<
  TableSizing,
  stylex.StyleXStyles
>;

const viewportStyles = { content: styles.content, fill: styles.fillViewport } satisfies Record<
  TableSizing,
  stylex.StyleXStyles
>;

export type DataTableColumnLayout = {
  readonly id: string;
  readonly label: string;
  readonly role: DataTableColumnRole;
  readonly width?: number;
  readonly isSecondary?: boolean;
};

export type DataTableColumn<Row> = DataTableColumnLayout & {
  readonly cell: (row: Row) => ReactNode;
  readonly shouldTruncate?: boolean;
  readonly canSort?: boolean;
};

export type DataTablePlaceholderProps = {
  readonly columns: ReadonlyArray<DataTableColumnLayout & { readonly placeholder?: ReactNode }>;
  readonly sizing?: TableSizing;
  readonly rowSizing?: RowSizing;
  readonly hideHeaders?: boolean;
};

function prepareColumns<Column extends DataTableColumnLayout>(columns: ReadonlyArray<Column>) {
  return columns.map((column) => {
    const geometry = columnGeometry[column.role];
    const width = column.width ?? (geometry.isFlexible ? undefined : geometry.minimumWidth);

    return { ...column, ...(width === undefined ? {} : { width }) };
  });
}

function tableWidths(columns: ReadonlyArray<DataTableColumnLayout>, selectionWidth = 0) {
  const minimumWidth = columns.reduce(
    (total, column) => total + (column.width ?? columnGeometry[column.role].minimumWidth),
    selectionWidth,
  );

  const compactWidth = columns
    .filter((column) => column.isSecondary !== true)
    .reduce((total, column) => total + (column.width ?? columnGeometry[column.role].minimumWidth), selectionWidth);

  return { minimumWidth, compactWidth };
}

function subscribeToCompactTable(onChange: () => void): () => void {
  const query = globalThis.matchMedia(compactTableQuery);

  query.addEventListener('change', onChange);

  return () => query.removeEventListener('change', onChange);
}

function isCompactTable(): boolean {
  return globalThis.matchMedia(compactTableQuery).matches;
}

function ColumnGroup({
  columns,
  canSelect = false,
}: {
  readonly columns: ReadonlyArray<DataTableColumnLayout>;
  readonly canSelect?: boolean;
}): ReactNode {
  return (
    <colgroup>
      {canSelect && <col {...stylex.props(styles.selection)} />}
      {columns.map((column) => (
        <col
          key={column.id}
          {...stylex.props(
            column.width !== undefined && styles.width(column.width),
            column.isSecondary === true && styles.secondary,
          )}
        />
      ))}
    </colgroup>
  );
}

export function DataTablePlaceholder({
  columns: suppliedColumns,
  sizing = 'content',
  rowSizing = 'fixed',
  hideHeaders = false,
}: DataTablePlaceholderProps): ReactNode {
  const columns = prepareColumns(suppliedColumns);
  const { minimumWidth, compactWidth } = tableWidths(columns);

  return (
    <div aria-hidden inert {...stylex.props(styles.frame, frameStyles[sizing], styles.placeholder)}>
      <div {...stylex.props(styles.viewport, viewportStyles[sizing])}>
        <table {...stylex.props(styles.table, styles.fixed, styles.minimumWidth(minimumWidth, compactWidth))}>
          <ColumnGroup columns={columns} />
          <thead {...stylex.props(hideHeaders && accessibility.hidden)}>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  {...stylex.props(
                    styles.header,
                    columnRoleStyles[column.role],
                    column.width !== undefined && styles.width(column.width),
                    column.isSecondary === true && styles.secondary,
                  )}
                >
                  <span {...stylex.props(styles.headerLabel)}>{column.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {['first', 'second', 'third'].map((row) => (
              <tr key={row} {...stylex.props(styles.row)}>
                {columns.map((column) => (
                  <td
                    key={column.id}
                    {...stylex.props(
                      styles.cell,
                      cellSizingStyles[rowSizing],
                      columnRoleStyles[column.role],
                      column.width !== undefined && styles.width(column.width),
                      column.isSecondary === true && styles.secondary,
                    )}
                  >
                    <TableCellContent role={column.role} isFixed={rowSizing === 'fixed'} shouldTruncate={undefined}>
                      {column.placeholder ?? <SkeletonText width="60%" />}
                    </TableCellContent>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export type DataTableTextProps = {
  readonly children: string;
  readonly secondary?: string | undefined;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
};

export type DataTableTextPlaceholderProps = { readonly leading?: ReactNode; readonly isSecondary?: boolean };

function TextCellLayout({
  children,
  leading,
  isDecorative = false,
}: {
  readonly children: ReactNode;
  readonly leading?: ReactNode;
  readonly isDecorative?: boolean;
}): ReactNode {
  const hasLeading = Children.toArray(leading).length > 0;

  return (
    <span aria-hidden={isDecorative || undefined} inert={isDecorative || undefined} {...stylex.props(styles.textRow)}>
      {hasLeading && (
        <span aria-hidden {...stylex.props(styles.adornment)}>
          {leading}
        </span>
      )}
      <span {...stylex.props(styles.textColumn)}>{children}</span>
    </span>
  );
}

export function DataTableText({ children, secondary, leading, trailing }: DataTableTextProps): ReactNode {
  const hasTrailing = Children.toArray(trailing).length > 0;

  return (
    <TextCellLayout leading={leading}>
      <span {...stylex.props(styles.primaryRow)}>
        <span title={children} {...stylex.props(styles.text, styles.primaryText, styles.truncated)}>
          {children}
        </span>
        {hasTrailing && <span {...stylex.props(styles.adornment)}>{trailing}</span>}
      </span>
      {secondary !== undefined && (
        <span title={secondary} {...stylex.props(styles.text, styles.truncated, styles.secondaryText)}>
          {secondary}
        </span>
      )}
    </TextCellLayout>
  );
}

export function DataTableTextPlaceholder({ leading, isSecondary = false }: DataTableTextPlaceholderProps): ReactNode {
  return (
    <TextCellLayout leading={leading} isDecorative>
      <span {...stylex.props(styles.text)}>
        <SkeletonText width="70%" />
      </span>
      {isSecondary && (
        <span {...stylex.props(styles.text, styles.secondaryText)}>
          <SkeletonText width="45%" />
        </span>
      )}
    </TextCellLayout>
  );
}

export type DataTableSort = { readonly columnId: string; readonly direction: 'ascending' | 'descending' };

export type DataTableWindow = { readonly height: number | 'fill'; readonly estimatedRowHeight?: number };

export type DataTableRowAction<Row> = { readonly label?: (row: Row) => string } & (
  | { readonly href: (row: Row) => string; readonly onActivate?: (row: Row) => void; readonly disabled?: never }
  | ({ readonly href?: never; readonly onActivate: (row: Row) => void } & Pick<ComponentProps<'button'>, 'disabled'>)
);

type SortProperties<Row> =
  | {
      readonly columns: ReadonlyArray<DataTableColumn<Row>>;
      readonly sort: DataTableSort | undefined;
      readonly onSortChange: (sort: DataTableSort | undefined) => void;
    }
  | {
      readonly columns: ReadonlyArray<DataTableColumn<Row> & { readonly canSort?: false }>;
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

type ReportedRowHighlight = { readonly id: string | undefined };

export type DataTableProps<Row> = SortProperties<Row> &
  OptionalSelection<Row> & {
    readonly rows: ReadonlyArray<Row>;
    readonly getRowId: (row: Row) => string;
    readonly caption: string;
    readonly empty: ReactNode;
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
  };

export function DataTable<Row extends object>({
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
}: DataTableProps<Row>): ReactNode {
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
  const [focusedId, setFocusedId] = useState<string>();
  const [hoveredId, setHoveredId] = useState<string>();
  const reportedHighlight = useRef<ReportedRowHighlight | undefined>(undefined);
  const pendingFocusId = useRef<string | undefined>(undefined);
  const restoredFocusId = useRef<string | undefined>(undefined);
  const focusedIndex = rows.findIndex((row) => getRowId(row) === focusedId);
  const primaryColumnIndex = columns.findIndex((column) => column.role === 'primary' && column.isSecondary !== true);

  const actionColumnIndex =
    primaryColumnIndex === -1 ? columns.findIndex((column) => column.isSecondary !== true) : primaryColumnIndex;

  const sizing = typeof window?.height === 'string' ? window.height : 'content';
  const rowIds = new Set(rows.map(getRowId));
  const validFocusedId = focusedId !== undefined && rowIds.has(focusedId) ? focusedId : undefined;

  if (focusedId !== undefined && validFocusedId === undefined) {
    setFocusedId(undefined);
  }

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

  const validHoveredId = rendered.some(({ row }) => row.id === hoveredId) ? hoveredId : undefined;
  const highlightedId = validHoveredId ?? validFocusedId;

  if (hoveredId !== undefined && validHoveredId === undefined) {
    setHoveredId(undefined);
  }

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

  const isReturnRowRendered = rendered.some(({ row }) => row.id === focusRowId);

  useLayoutEffect(() => {
    if (focusRowId === undefined) {
      restoredFocusId.current = undefined;

      return;
    }

    if (restoredFocusId.current === focusRowId) {
      return;
    }

    if (!isReturnRowRendered && window !== undefined) {
      const index = rows.findIndex((row) => getRowId(row) === focusRowId);

      if (index !== -1) {
        virtualizer.scrollToIndex(index, { align: 'auto' });
      }

      return;
    }

    const row = viewport.current?.querySelector<HTMLElement>(
      `[data-row-id="${CSS.escape(focusRowId)}"] [data-row-action]`,
    );

    if (row === undefined || row === null || row.matches(':disabled')) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      row.focus({ preventScroll: true });

      if (document.activeElement === row) {
        restoredFocusId.current = focusRowId;
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [rows, focusRowId, rowAction?.disabled, isReturnRowRendered, window, getRowId, viewport, virtualizer]);

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
    const hasCommandModifier = event.metaKey || event.ctrlKey;
    const hasAlternateModifier = event.altKey || event.shiftKey;

    if (hasCommandModifier || hasAlternateModifier) {
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

  const visibleColumnCount = columns.filter((column) => !isCompact || column.isSecondary !== true).length;
  const columnCount = visibleColumnCount + (selectedIds === undefined ? 0 : 1);
  const selectionWidth = selectedIds === undefined ? 0 : selectionColumnWidth;
  const showFooter = footer !== undefined && footer !== null && typeof footer !== 'boolean';
  const { minimumWidth, compactWidth } = tableWidths(columns, selectionWidth);

  const trailingSpace =
    virtualizer.getTotalSize() - (virtualizer.getVirtualItems().at(-1)?.end ?? headerHeight) + headerHeight;

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
        <table
          aria-rowcount={window === undefined ? undefined : Math.max(1, rows.length) + 1}
          {...stylex.props(styles.table, styles.fixed, styles.minimumWidth(minimumWidth, compactWidth))}
        >
          <caption ref={captionElement} {...stylex.props(styles.caption, hideCaption && accessibility.hidden)}>
            {caption}
          </caption>
          <ColumnGroup columns={columns} canSelect={selectedIds !== undefined} />
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
                      columnRoleStyles[column.role],
                      column.width !== undefined && styles.width(column.width),
                      column.isSecondary === true && styles.secondary,
                    )}
                  >
                    {column.canSort === true && onSortChange !== undefined ? (
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
            onPointerLeave={() => setHoveredId(undefined)}
            onKeyDownCapture={() => setHoveredId(undefined)}
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
                    setFocusedId(row.id);
                  }}
                  {...stylex.props(
                    styles.row,
                    rowAction !== undefined && rowAction.disabled !== true && styles.actionable,
                    (selectedIds?.has(row.id) === true || activeRowId === row.id) && styles.selected,
                  )}
                >
                  {selectedIds !== undefined && (
                    <td {...stylex.props(styles.cell, styles.selection, styles.rowControl)}>
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
                        columnRoleStyles[column.role],
                        column.width !== undefined && styles.width(column.width),
                        column.isSecondary === true && styles.secondary,
                      )}
                    >
                      {rowAction !== undefined && columnIndex === actionColumnIndex ? (
                        <RowTrigger
                          row={row.original}
                          action={rowAction}
                          isActive={activeRowId === row.id}
                          onKeyDown={(event) => moveFocus(event, index)}
                        >
                          <TableCellContent
                            role={column.role}
                            isFixed={rowSizing === 'fixed'}
                            shouldTruncate={column.shouldTruncate}
                          >
                            {column.cell(row.original)}
                          </TableCellContent>
                        </RowTrigger>
                      ) : (
                        <TableCellContent
                          role={column.role}
                          isFixed={rowSizing === 'fixed'}
                          shouldTruncate={column.shouldTruncate}
                        >
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
                <td colSpan={columnCount} {...stylex.props(styles.emptyCell)}>
                  <div {...stylex.props(styles.empty)}>{empty}</div>
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
  role,
  isFixed,
  shouldTruncate,
  children,
}: {
  readonly role: DataTableColumnRole;
  readonly isFixed: boolean;
  readonly shouldTruncate: boolean | undefined;
  readonly children: ReactNode;
}): ReactNode {
  const geometry = columnGeometry[role];
  const shouldTruncateByDefault = isFixed && geometry.shouldTruncate;
  const isTruncated = typeof children === 'string' && (shouldTruncate ?? shouldTruncateByDefault);

  return (
    <span {...stylex.props(styles.cellViewport, !isFixed && styles.contentViewport)}>
      <span
        title={typeof children === 'string' ? children : undefined}
        {...stylex.props(
          styles.cellContent,
          isFixed && styles.fixedContent,
          isFixed && !geometry.shouldTruncate && styles.readable,
          isTruncated && styles.truncated,
        )}
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

  const hasCommandModifier = event.metaKey || event.ctrlKey;
  const hasAlternateModifier = event.altKey || event.shiftKey;

  if (hasCommandModifier || hasAlternateModifier) {
    return false;
  }

  return event.detail === 0 || event.currentTarget.ownerDocument.getSelection()?.isCollapsed !== false;
}

type RowTriggerProps<Row> = {
  readonly row: Row;
  readonly action: DataTableRowAction<Row>;
  readonly isActive: boolean;
  readonly children: ReactNode;
  readonly onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
};

function RowTrigger<Row>({ row, action, isActive, children, onKeyDown }: RowTriggerProps<Row>): ReactNode {
  const label = action.label?.(row);

  const trigger =
    action.href === undefined ? (
      <button
        type="button"
        disabled={action.disabled}
        aria-label={label}
        aria-pressed={isActive}
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
