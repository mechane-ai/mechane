import * as stylex from '@stylexjs/stylex';
import { announce, isRTL } from '@ui-sdk/core';
import type { CellBounds } from '@ui-sdk/core';
import { useId, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent, PointerEvent, ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { Chart, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartView } from '../chart.tsx';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureFrameInput, FigureSelectionProps } from '../figure/figure-props.ts';
import { usePlotWidth } from '../plot-width.ts';
import { ColorLegend } from './color-legend.tsx';
import { heatmapColor, heatmapScaleProblem, isHeatmapValueInDomain } from './heatmap-scale.ts';
import type { HeatmapScale } from './heatmap-scale.ts';
import { cellTextCapacity, cellValueText, matrixCellGlyph, matrixValueText } from './matrix-cells.ts';
import { MatrixMark } from './matrix-mark.tsx';
import type { MatrixCellView, MatrixMarking } from './matrix-mark.tsx';
import {
  extendRange,
  isInBounds,
  rangeBounds,
  rangeProblem,
  rangeSummary,
  rangeText,
  wholeRange,
} from './matrix-range.ts';
import { MatrixStrip } from './matrix-strip.tsx';
import { matrixCellId } from './matrix-types.ts';
import type {
  MatrixAxisItem,
  MatrixCell,
  MatrixCellRange,
  MatrixCellRangeProps,
  MatrixCellValuesProps,
  MatrixCoordinate,
} from './matrix-types.ts';

/** The render limit every matrix shares. Larger input shows an explicit error; the application supplies a window. */
export const matrixLimits = { cells: 4096 } as const;

export type MatrixFigureProps = FigureFrameInput &
  FigureSelectionProps &
  MatrixCellRangeProps &
  MatrixCellValuesProps &
  HeatmapScale & {
    readonly emptyLabel: string;
    readonly rows: ReadonlyArray<MatrixAxisItem>;
    readonly columns: ReadonlyArray<MatrixAxisItem>;
    readonly cells: ReadonlyArray<MatrixCell>;
    /** The exact value format for readouts and the exact-value table. */
    readonly valueFormat: ValueFormat;
    /** What a cell writes inside itself, when it differs from the exact value, such as a share of its row. */
    readonly glyphFormat?: ValueFormat | undefined;
    /** What the color measures, for the legend and the table. */
    readonly valueLabel: string;
    readonly variant: 'values' | 'strip';
    /** What rows and columns stand for, shown at the corner and above the columns: "Actual", "Predicted". */
    readonly rowTitle?: string | undefined;
    readonly columnTitle?: string | undefined;
    /** The nouns a range summary uses for a row and a column. */
    readonly rowNoun?: string | undefined;
    readonly columnNoun?: string | undefined;
    /** Token text and other literals read best in the mono face. */
    readonly axisFont?: 'text' | 'mono' | undefined;
    /** Strip headers clip to their column, or run past it for sparse labels such as months over weeks. */
    readonly headers?: 'clip' | 'overflow' | undefined;
    readonly marking?: ((row: MatrixAxisItem, column: MatrixAxisItem) => MatrixMarking | undefined) | undefined;
    /** The coordinate part of a cell's sentence. Absent writes "row → column". */
    readonly cellLabel?: ((row: MatrixAxisItem, column: MatrixAxisItem) => string) | undefined;
    /** A cell's exact value text. Absent writes the value in the value format, or the cell's state. */
    readonly valueText?: ((cell: MatrixCell | undefined) => string) | undefined;
    /** A cell's copied text. Absent copies the supplied number exactly, and nothing for a cell without one. */
    readonly copyText?: ((cell: MatrixCell | undefined) => string) | undefined;
    /** More lines for the key under the plot, such as "Outlined: correct predictions". */
    readonly notes?: ReadonlyArray<string> | undefined;
    /** The preset's own reason to refuse its input, checked before the shared rules. */
    readonly problem?: string | undefined;
  };

const RANGE_EDGE_PX = 2;
const BORDER_SPACING_PX = 2;
const CHARACTER_PX = 7.5;
const ROW_HEADER_MAX_PX = 160;
const ROW_HEADER_INSET_PX = 12;
const HEADER_INSET_PX = 8;
const ROTATED_HEADER_MAX_PX = 120;
const HEADER_LINES = 2;

/** The smallest and largest square cell, with values written in them or as color only. */
const cellSizes = { shown: { min: 40, max: 56 }, hidden: { min: 16, max: 36 } } as const;

const styles = stylex.create({
  scroll: {
    'overflow': 'auto',
    'maxHeight': 640,
    'minWidth': 0,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -2,
    },
  },
  measure: { minWidth: 0 },
  table: {
    borderCollapse: 'separate',
    borderSpacing: BORDER_SPACING_PX,
    width: 'max-content',
    fontFamily: typography.fontFamily,
  },
  label: {
    padding: 0,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.regularWeight,
    color: colors.muted,
    textAlign: 'start',
    whiteSpace: 'nowrap',
  },
  title: { color: colors.ink, fontWeight: typography.mediumWeight, paddingBlockEnd: spacing.xs },
  axisText: {
    display: '-webkit-box',
    overflow: 'hidden',
    WebkitBoxOrient: 'vertical',
    WebkitLineClamp: HEADER_LINES,
    whiteSpace: 'normal',
    textAlign: 'center',
    paddingBlock: spacing.xs,
  },
  bottom: { verticalAlign: 'bottom' },
  rotatedHead: { textAlign: 'center' },
  rotated: {
    display: 'inline-block',
    maxHeight: ROTATED_HEADER_MAX_PX,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    paddingInline: spacing.xs,
  },
  rowText: {
    display: 'block',
    maxWidth: ROW_HEADER_MAX_PX,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    paddingInlineEnd: spacing.md,
  },
  cell: { padding: 0, textAlign: 'center' },
  width: (size: number) => ({ width: size }),
  square: (size: number) => ({ width: size, height: size }),
  value: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.ink,
    padding: 0,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    fontWeight: typography.regularWeight,
    lineHeight: typography.captionLineHeight,
    fontVariantNumeric: 'tabular-nums',
  },
  measured: (color: string) => ({ backgroundImage: `linear-gradient(${color}, ${color})` }),
  valueText: { backgroundColor: colors.surface, paddingInline: spacing.xxs },
  missing: { color: colors.muted, backgroundColor: colors.canvas, borderStyle: 'dashed' },
  masked: { color: colors.muted, backgroundColor: colors.canvas },
  outlined: { borderWidth: 2, borderColor: colors.ink },
  context: { color: colors.muted },
  footer: { display: 'grid', gap: spacing.md },
  key: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.md,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    color: colors.muted,
    fontSize: typography.captionSize,
  },
  strip: { paddingBlock: spacing.xxs },
});

/** Cells that write values keep a touch-sized target on a coarse pointer; color-only cells stay small. */
const touches = stylex.create({
  shown: {
    minWidth: { default: null, [conditions.coarsePointer]: controls.coarseTarget },
    minHeight: { default: null, [conditions.coarsePointer]: controls.coarseTarget },
  },
  hidden: {},
});

const fonts = stylex.create({ text: {}, mono: { fontFamily: typography.monoFamily, whiteSpace: 'pre' } });

const cellStyles = { value: undefined, masked: styles.masked, missing: styles.missing } satisfies Record<
  MatrixCell['kind'],
  stylex.StyleXStyles | undefined
>;

const CONTEXT_SHARE = 28;
const navigationKeys: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

function edgeShadow(bounds: CellBounds | undefined, row: number, column: number): string | undefined {
  if (bounds === undefined || !isInBounds(bounds, row, column)) {
    return undefined;
  }

  const color = colors.ink;

  const sides = [
    row === bounds.top ? `inset 0 ${RANGE_EDGE_PX}px 0 0 ${color}` : undefined,
    row === bounds.bottom ? `inset 0 -${RANGE_EDGE_PX}px 0 0 ${color}` : undefined,
    column === bounds.left ? `inset ${RANGE_EDGE_PX}px 0 0 0 ${color}` : undefined,
    column === bounds.right ? `inset -${RANGE_EDGE_PX}px 0 0 0 ${color}` : undefined,
  ].filter((side) => side !== undefined);

  return sides.length === 0 ? undefined : sides.join(', ');
}

/** Whether a column header reads across its cell: on one line, or on two lines broken at spaces and hyphens. */
function isHeaderFitting(
  label: string,
  { lineCharacters, font }: { readonly lineCharacters: number; readonly font: 'text' | 'mono' },
): boolean {
  const length = Array.from(label).length;

  if (font === 'mono' || length <= lineCharacters) {
    return length <= lineCharacters;
  }

  const words = label.split(/(?<=[\s-])/u);

  return length <= lineCharacters * HEADER_LINES && words.every((word) => Array.from(word).length <= lineCharacters);
}

function matrixProblem({
  rows,
  columns,
  cells,
  domain,
  palette,
}: Pick<MatrixFigureProps, 'rows' | 'columns' | 'cells' | 'domain' | 'palette'>): string | undefined {
  const scaleProblem = heatmapScaleProblem({ domain, palette });

  if (scaleProblem !== null) {
    return scaleProblem;
  }

  if (rows.length * columns.length > matrixLimits.cells || cells.length > matrixLimits.cells) {
    return `This matrix exceeds the ${matrixLimits.cells}-cell render limit. Supply a smaller, labelled window.`;
  }

  if (!hasUniqueIds(rows) || !hasUniqueIds(columns) || !hasUniqueIds(cells)) {
    return 'Matrix rows, columns, and cells must have unique identifiers.';
  }

  const rowIds = new Set(rows.map((row) => row.id));
  const columnIds = new Set(columns.map((column) => column.id));

  if (cells.some((cell) => !rowIds.has(cell.rowId) || !columnIds.has(cell.columnId))) {
    return 'Every matrix cell must refer to a supplied row and column.';
  }

  if (cells.some((cell) => cell.kind === 'value' && !Number.isFinite(cell.value))) {
    return 'Measured matrix values must be finite. Use a missing cell for unavailable values.';
  }

  const coordinates = new Set(cells.map((cell) => matrixCellId(cell.rowId, cell.columnId)));

  return coordinates.size === cells.length ? undefined : 'A matrix coordinate may contain only one cell.';
}

function exactNumber(cell: MatrixCell | undefined): string {
  return cell?.kind === 'value' ? String(cell.value) : '';
}

/**
 * The drawing every matrix shares: headers, cells, the keyboard and pointer inspection, the controlled selection and
 * cell range, copying, the legend, the readout and the exact-value table. Matrix and its presets set what each cell
 * means; this draws it.
 */
export function MatrixFigure(props: MatrixFigureProps): ReactNode {
  const {
    emptyLabel,
    rows,
    columns,
    cells,
    domain,
    palette,
    valueFormat,
    glyphFormat = valueFormat,
    valueLabel,
    variant,
    rowTitle,
    columnTitle,
    rowNoun,
    columnNoun,
    axisFont = 'text',
    headers = 'clip',
    cellValues = 'shown',
    marking,
    cellLabel = (row, column) => `${row.label} → ${column.label}`,
    valueText,
    copyText = exactNumber,
    notes = [],
    problem,
    selected,
    onSelectedChange,
    cellRange = null,
    onCellRangeChange,
    ...frame
  } = props;

  const { locale, title } = frame;
  const readoutId = useId();
  const drag = useRef<MatrixCoordinate | null>(null);
  const size = usePlotWidth();
  const link = useLinkedInspection();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} />;
  }

  const inputProblem =
    problem ?? matrixProblem({ rows, columns, cells, domain, palette }) ?? rangeProblem(cellRange, { rows, columns });

  if (inputProblem !== undefined) {
    return <FigureInvalid {...frame} message={inputProblem} />;
  }

  const isStrip = variant === 'strip';
  const byCoordinate = new Map(cells.map((cell) => [matrixCellId(cell.rowId, cell.columnId), cell]));

  function cellAt(rowId: string, columnId: string): MatrixCell | undefined {
    return byCoordinate.get(matrixCellId(rowId, columnId));
  }

  function exactText(cell: MatrixCell | undefined): string {
    return valueText?.(cell) ?? matrixValueText({ cell, domain, locale, format: valueFormat });
  }

  const longestRow = Math.max(Array.from(rowTitle ?? '').length, ...rows.map((row) => Array.from(row.label).length));
  const rowHeader = Math.min(ROW_HEADER_MAX_PX, longestRow * CHARACTER_PX) + ROW_HEADER_INSET_PX;
  const sizes = cellSizes[cellValues];
  const room = size.width - rowHeader - BORDER_SPACING_PX * (columns.length + 2);
  const cellSize = Math.min(sizes.max, Math.max(sizes.min, Math.floor(room / Math.max(1, columns.length))));
  const lineCharacters = Math.floor((cellSize - HEADER_INSET_PX) / CHARACTER_PX);
  const isRotated = columns.some((column) => !isHeaderFitting(column.label, { lineCharacters, font: axisFont }));
  const capacity = cellTextCapacity(cellSize);

  const drawn = rows.flatMap((row, rowIndex) =>
    columns.flatMap((column, columnIndex) => {
      const mark = marking?.(row, column);

      if (mark === 'hidden') {
        return [];
      }

      const cell = cellAt(row.id, column.id);
      const id = cell?.id ?? matrixCellId(row.id, column.id);
      const isOutside = cell?.kind === 'value' && !isHeatmapValueInDomain(cell.value, domain);

      const text =
        cell?.kind === 'value' && cellValues === 'shown'
          ? cellValueText({ value: cell.value, locale, format: glyphFormat, capacity })
          : '';

      const glyph = cell === undefined ? '·' : matrixCellGlyph(cell, text, isOutside);
      const label = `${cellLabel(row, column)}: ${exactText(cell)}`;

      return [{ id, row, column, rowIndex, columnIndex, cell, mark, label, isOutside, glyph }];
    }),
  );

  const isHiding = drawn.length < rows.length * columns.length;
  const items = drawn.filter((entry) => isStrip || entry.cell !== undefined).map(({ id, label }) => ({ id, label }));
  const byId = new Map(drawn.map((entry) => [entry.id, entry]));
  const bounds = cellRange === null ? undefined : rangeBounds(cellRange, { rows, columns });
  const canRange = onCellRangeChange !== undefined;

  const summary =
    bounds === undefined
      ? undefined
      : rangeSummary({
          bounds,
          rows,
          columns,
          rowNoun,
          columnNoun,
          count: drawn.filter((entry) => isInBounds(bounds, entry.rowIndex, entry.columnIndex)).length,
        });

  function changeRange(
    range: MatrixCellRange | null,
    reason: 'list-navigation' | 'item-press' | 'drag',
    event: Event,
  ): void {
    onCellRangeChange?.(range, { reason, event });

    if (range !== null && reason === 'list-navigation') {
      const next = rangeBounds(range, { rows, columns });
      const count = drawn.filter((entry) => isInBounds(next, entry.rowIndex, entry.columnIndex)).length;

      announce(rangeSummary({ bounds: next, rows, columns, rowNoun, columnNoun, count }));
    }
  }

  function coordinateOf(id: string | null): MatrixCoordinate | undefined {
    const entry = id === null ? undefined : byId.get(id);

    return entry === undefined ? undefined : { rowId: entry.row.id, columnId: entry.column.id };
  }

  function coordinateAt(target: EventTarget | null): MatrixCoordinate | undefined {
    const element = target instanceof Element ? target.closest('[data-matrix-row]') : null;
    const { matrixRow, matrixColumn } = element instanceof HTMLElement ? element.dataset : {};

    return matrixRow === undefined || matrixColumn === undefined
      ? undefined
      : { rowId: matrixRow, columnId: matrixColumn };
  }

  function rangeKeys(event: KeyboardEvent<HTMLElement>, cursor: string | null): void {
    const isModified = event.ctrlKey || event.metaKey;

    if (isModified && event.key === 'a') {
      const all = wholeRange({ rows, columns });

      if (all !== undefined) {
        event.preventDefault();
        changeRange(all, 'list-navigation', event.nativeEvent);
      }

      return;
    }

    if (event.key === 'Escape' || (!event.shiftKey && navigationKeys.has(event.key))) {
      if (cellRange !== null) {
        changeRange(null, 'list-navigation', event.nativeEvent);
      }

      return;
    }

    const from = coordinateOf(cursor);

    const isExtension = event.shiftKey && !isModified && !event.altKey;

    if (!isExtension || from === undefined) {
      return;
    }

    const next = extendRange({
      key: event.key,
      range: cellRange,
      from,
      isReversed: isRTL(event.currentTarget),
      rows,
      columns,
    });

    if (next !== undefined) {
      event.preventDefault();
      changeRange(next, 'list-navigation', event.nativeEvent);
    }
  }

  function pressCell(event: PointerEvent<HTMLElement>, cursor: string | null): void {
    const at = coordinateAt(event.target);

    if (at === undefined) {
      return;
    }

    if (event.shiftKey) {
      const anchor = cellRange?.anchor ?? coordinateOf(cursor) ?? at;

      changeRange({ anchor, end: at }, 'item-press', event.nativeEvent);

      return;
    }

    drag.current = at;

    if (cellRange !== null) {
      changeRange(null, 'item-press', event.nativeEvent);
    }
  }

  function dragAcross(event: PointerEvent<HTMLElement>): void {
    const anchor = drag.current;
    const at = coordinateAt(event.target);

    if (anchor === null || at === undefined || event.buttons !== 1) {
      return;
    }

    const isSame = cellRange?.end.rowId === at.rowId && cellRange.end.columnId === at.columnId;
    const isStart = cellRange === null && anchor.rowId === at.rowId && anchor.columnId === at.columnId;

    if (!isSame && !isStart) {
      changeRange({ anchor, end: at }, 'drag', event.nativeEvent);
    }
  }

  function copy(event: ClipboardEvent<HTMLElement>, cursor: string | null): void {
    const at = coordinateOf(cursor);
    const range = cellRange ?? (at === undefined ? undefined : { anchor: at, end: at });

    if (range === undefined) {
      return;
    }

    const text = rangeText({
      bounds: rangeBounds(range, { rows, columns }),
      rows,
      columns,
      read: ({ rowId, columnId }) =>
        byId.has(cellAt(rowId, columnId)?.id ?? matrixCellId(rowId, columnId)) ? copyText(cellAt(rowId, columnId)) : '',
    });

    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
  }

  function views(view: ChartView): ReadonlyMap<string, MatrixCellView> {
    return new Map(
      drawn.map((entry) => {
        const { cell, isOutside } = entry;
        const isContext = entry.mark === 'context';

        const fill = isContext
          ? `color-mix(in srgb, ${colors.muted} ${CONTEXT_SHARE}%, ${colors.surface})`
          : cell?.kind === 'value' && !isOutside
            ? heatmapColor(cell.value, { domain, palette })
            : undefined;

        return [
          matrixCellId(entry.row.id, entry.column.id),
          {
            id: entry.id,
            row: entry.row,
            column: entry.column,
            cell,
            label: entry.label,
            glyph: entry.glyph,
            fill,
            isOutside,
            marking: entry.mark,
            edges: edgeShadow(bounds, entry.rowIndex, entry.columnIndex),
            isSelected: cell !== undefined && selected === cell.id,
            isInspected: view.inspected === entry.id,
            isCursor: view.cursor === entry.id,
          },
        ];
      }),
    );
  }

  const isEmpty = rows.length === 0 || columns.length === 0;
  const label = plotLabel({ title, isSelectable: onSelectedChange !== undefined });
  const hasLongValues = drawn.some((entry) => entry.glyph === '•');
  const isValueless = isStrip || cellValues === 'hidden';

  const keyLines = [
    cells.some((cell) => cell.kind === 'masked') ? '× Masked' : undefined,
    cells.some((cell) => cell.kind === 'missing') ? '— Missing' : undefined,
    drawn.some((entry) => entry.cell === undefined) ? '· Not supplied' : undefined,
    cells.some((cell) => cell.kind === 'value' && !isHeatmapValueInDomain(cell.value, domain))
      ? '! Outside domain'
      : undefined,
    isValueless ? 'Inspect a cell for its exact value' : undefined,
    !isValueless && hasLongValues ? '• Inspect a cell for its exact value' : undefined,
    ...notes,
    canRange ? 'Shift with the arrow keys or a drag marks a block to copy' : undefined,
  ].filter((line) => line !== undefined);

  return (
    <Chart
      {...link}
      items={items}
      columns={isStrip && !isHiding ? columns.length : undefined}
      place={
        isStrip && !isHiding
          ? undefined
          : (id) => {
              const entry = byId.get(id);

              return entry === undefined
                ? undefined
                : {
                    left: entry.columnIndex,
                    top: entry.rowIndex,
                    right: entry.columnIndex + 1,
                    bottom: entry.rowIndex + 1,
                  };
            }
      }
      selected={selected ?? null}
      onSelect={
        onSelectedChange === undefined
          ? undefined
          : (id, details) => {
              if (cells.some((cell) => cell.id === id)) {
                onSelectedChange(id, details);
              }
            }
      }
      render={(figure, view) => {
        const shown = views(view);

        const plotHandlers = {
          onCopy: (event: ClipboardEvent<HTMLDivElement>) => copy(event, view.cursor),
          ...(canRange
            ? {
                onKeyDownCapture: (event: KeyboardEvent<HTMLDivElement>) => rangeKeys(event, view.cursor),
                onPointerDown: (event: PointerEvent<HTMLDivElement>) => pressCell(event, view.cursor),
                onPointerMove: dragAcross,
                onPointerUp: () => {
                  drag.current = null;
                },
              }
            : {}),
        };

        return (
          <FigureFrame
            {...frame}
            figure={figure}
            scaleLegend={
              isEmpty ? undefined : (
                <ColorLegend
                  label={valueLabel}
                  domain={domain}
                  palette={palette}
                  valueFormat={valueFormat}
                  locale={locale}
                />
              )
            }
            footer={
              isEmpty ? undefined : (
                <div {...stylex.props(styles.footer)}>
                  {keyLines.length > 0 && (
                    <ul aria-label="Cell states" {...stylex.props(styles.key)}>
                      {keyLines.map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  )}
                  <ChartReadout id={readoutId}>{summary ?? inspectedLabel(items, view.inspected)}</ChartReadout>
                  <ChartData
                    label={`${title} cells`}
                    columns={[
                      { id: 'cell', label: 'Cell' },
                      { id: 'value', label: valueLabel },
                    ]}
                    rows={drawn.map((entry) => ({
                      id: matrixCellId(entry.row.id, entry.column.id),
                      values: [cellLabel(entry.row, entry.column), exactText(entry.cell)],
                    }))}
                  />
                </div>
              )
            }
          >
            {isEmpty ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <div ref={size.ref} {...stylex.props(styles.measure)}>
                <ChartPlot
                  role="group"
                  aria-label={label}
                  aria-describedby={readoutId}
                  {...plotHandlers}
                  {...stylex.props(styles.scroll, isStrip && styles.strip, stylex.defaultMarker())}
                >
                  {isStrip ? (
                    <MatrixStrip
                      rows={rows}
                      columns={columns}
                      rowTitle={rowTitle}
                      columnTitle={columnTitle}
                      font={axisFont}
                      headers={headers}
                      viewAt={(rowId, columnId) => shown.get(matrixCellId(rowId, columnId))}
                      isSelectable={onSelectedChange !== undefined}
                    />
                  ) : (
                    <table {...stylex.props(styles.table)}>
                      <thead>
                        {columnTitle !== undefined && (
                          <tr>
                            <td />
                            <th colSpan={columns.length} scope="colgroup" {...stylex.props(styles.label, styles.title)}>
                              {columnTitle}
                            </th>
                          </tr>
                        )}
                        <tr>
                          <th {...stylex.props(styles.label, styles.title)}>{rowTitle}</th>
                          {columns.map((column) => (
                            <th
                              key={column.id}
                              scope="col"
                              title={column.label}
                              {...stylex.props(styles.label, styles.bottom, isRotated && styles.rotatedHead)}
                            >
                              <span
                                {...stylex.props(
                                  isRotated ? styles.rotated : [styles.axisText, styles.width(cellSize)],
                                  fonts[axisFont],
                                )}
                              >
                                {column.label}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id}>
                            <th scope="row" title={row.label} {...stylex.props(styles.label)}>
                              <span {...stylex.props(styles.rowText, fonts[axisFont])}>{row.label}</span>
                            </th>
                            {columns.map((column) => {
                              const cell = shown.get(matrixCellId(row.id, column.id));

                              return (
                                <td key={column.id} {...stylex.props(styles.cell, styles.width(cellSize))}>
                                  {cell === undefined ? null : (
                                    <MatrixMark
                                      view={cell}
                                      isSelectable={onSelectedChange !== undefined}
                                      appearance={[
                                        styles.value,
                                        styles.square(cellSize),
                                        touches[cellValues],
                                        cell.cell === undefined ? styles.missing : cellStyles[cell.cell.kind],
                                        cell.fill !== undefined && styles.measured(cell.fill),
                                        cell.isOutside && styles.missing,
                                        cell.marking === 'outlined' && styles.outlined,
                                        cell.marking === 'context' && styles.context,
                                      ]}
                                    >
                                      {cell.cell?.kind === 'value' ? (
                                        <span {...stylex.props(styles.valueText)}>{cell.glyph}</span>
                                      ) : (
                                        cell.glyph
                                      )}
                                    </MatrixMark>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </ChartPlot>
              </div>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
