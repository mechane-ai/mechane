import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartMark, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import { ColorLegend } from './color-legend.tsx';
import { heatmapColor, heatmapScaleProblem, isHeatmapValueInDomain } from './heatmap-scale.ts';
import type { HeatmapScale } from './heatmap-scale.ts';
import { CELL_TEXT_MAX_CHARACTERS, matrixCellGlyph, matrixValueText } from './matrix-cells.ts';
import { MatrixStrip } from './matrix-strip.tsx';
import type { MatrixAxisItem, MatrixCell } from './matrix-types.ts';

export type { MatrixAxisItem, MatrixCell } from './matrix-types.ts';

export type MatrixProps = HeatmapScale & {
  readonly title: string;
  readonly report?: ChartReport | undefined;
  readonly description: string;
  readonly rows: ReadonlyArray<MatrixAxisItem>;
  readonly columns: ReadonlyArray<MatrixAxisItem>;
  readonly cells: ReadonlyArray<MatrixCell>;
  readonly valueLabel: string;
  readonly formatValue: (value: number) => string;
  readonly selection?: ChartSelection;
  readonly emptyLabel: string;
  /**
   * The values variant draws square cells with short values for exact comparison. The strip variant draws compact
   * intensity rows that fill the width, such as months across categories. Absent means values.
   */
  readonly variant?: 'values' | 'strip' | undefined;
};

const styles = stylex.create({
  scroll: {
    'overflow': 'auto',
    'maxHeight': 480,
    'minWidth': 0,
    'outlineStyle': 'none',
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -2,
    },
  },
  table: { borderCollapse: 'separate', borderSpacing: 2, width: 'max-content', fontFamily: typography.fontFamily },
  label: {
    padding: 0,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    fontWeight: typography.regularWeight,
    color: colors.muted,
    textAlign: 'start',
    whiteSpace: 'nowrap',
  },
  axisText: {
    display: 'block',
    width: { default: 40, [conditions.coarsePointer]: controls.coarseTarget },
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    textAlign: 'center',
    paddingBlock: spacing.xs,
  },
  rowText: {
    display: 'block',
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    paddingInlineEnd: spacing.md,
  },
  cell: { padding: 0, width: { default: 40, [conditions.coarsePointer]: controls.coarseTarget }, textAlign: 'center' },
  value: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: { default: 40, [conditions.coarsePointer]: controls.coarseTarget },
    height: { default: 40, [conditions.coarsePointer]: controls.coarseTarget },
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
  interactive: {
    'cursor': 'pointer',
    'outlineStyle': 'none',
    ':active': { borderColor: colors.ink },
    ':focus-visible': {
      outlineWidth: controls.focusWidth,
      outlineColor: colors.focus,
      outlineStyle: 'solid',
      outlineOffset: -2,
    },
    ':hover': { borderColor: { [conditions.hoverPointer]: colors.ink } },
  },
  selected: { outlineWidth: controls.focusWidth, outlineColor: colors.focus, outlineStyle: 'solid', outlineOffset: -2 },
  measured: (color: string) => ({ backgroundImage: `linear-gradient(${color}, ${color})` }),
  valueText: { backgroundColor: colors.surface, paddingInline: spacing.xxs },
  missing: { color: colors.muted, backgroundColor: colors.canvas, borderStyle: 'dashed' },
  masked: { color: colors.muted, backgroundColor: colors.canvas },
  empty: { margin: 0, color: colors.muted, fontSize: typography.bodySize, lineHeight: typography.bodyLineHeight },
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
  data: { listStyle: 'none', margin: 0, padding: 0 },
  strip: { paddingBlock: spacing.xxs },
});

function coordinateId(rowId: string, columnId: string): string {
  return JSON.stringify([rowId, columnId]);
}

const cellStyles = { value: undefined, masked: styles.masked, missing: styles.missing } satisfies Record<
  MatrixCell['kind'],
  stylex.StyleXStyles | undefined
>;

export const MAX_MATRIX_CELLS = 4096;

export function Matrix({
  title,
  report,
  description,
  rows,
  columns,
  cells,
  domain,
  palette,
  valueLabel,
  formatValue,
  selection,
  emptyLabel,
  variant = 'values',
}: MatrixProps): ReactNode {
  const isStrip = variant === 'strip';

  function cellAt(rowId: string, columnId: string): MatrixCell | undefined {
    return cells.find((cell) => cell.rowId === rowId && cell.columnId === columnId);
  }

  const rowLabels = new Map(rows.map((row) => [row.id, row.label]));
  const columnLabels = new Map(columns.map((column) => [column.id, column.label]));

  // The strip steps through every coordinate row by row; the values table steps through the supplied cells.
  const items = isStrip
    ? rows.flatMap((row) =>
        columns.map((column) => {
          const cell = cellAt(row.id, column.id);

          return {
            id: cell?.id ?? coordinateId(row.id, column.id),
            label: `${row.label} → ${column.label}: ${matrixValueText(cell, domain, formatValue)}`,
          };
        }),
      )
    : cells.map((cell) => ({
        id: cell.id,
        label: `${rowLabels.get(cell.rowId) ?? cell.rowId} → ${columnLabels.get(cell.columnId) ?? cell.columnId}: ${matrixValueText(cell, domain, formatValue)}`,
      }));

  const readoutId = useId();
  const problem = matrixProblem({ rows, columns, cells, domain, palette });

  if (problem !== null) {
    return <ChartInputError title={title} report={report} description={description} message={problem} />;
  }

  const cellRows = new Map<string, Map<string, MatrixCell>>();

  for (const cell of cells) {
    const row = cellRows.get(cell.rowId) ?? new Map<string, MatrixCell>();

    row.set(cell.columnId, cell);
    cellRows.set(cell.rowId, row);
  }

  const rowIndices = new Map(rows.map((row, index) => [row.id, index]));
  const columnIndices = new Map(columns.map((column, index) => [column.id, index]));

  const places = new Map(
    cells.map((cell) => {
      const left = columnIndices.get(cell.columnId) ?? 0;
      const top = rowIndices.get(cell.rowId) ?? 0;

      return [cell.id, { left, top, right: left + 1, bottom: top + 1 }];
    }),
  );

  const label = plotLabel({ title, isSelectable: selection !== undefined });

  return (
    <Chart
      items={items}
      columns={isStrip ? columns.length : undefined}
      place={isStrip ? undefined : (id) => places.get(id)}
      selected={selection?.selectedId ?? null}
      onSelect={
        selection === undefined
          ? undefined
          : (id, details) => {
              if (cells.some((cell) => cell.id === id)) {
                selection.onSelect(id, details);
              }
            }
      }
      render={(figure, view) => (
        <ChartFrame
          figure={figure}
          title={title}
          report={report}
          description={description}
          footer={
            <div {...stylex.props(styles.footer)}>
              <ColorLegend label={valueLabel} domain={domain} palette={palette} formatValue={formatValue} />
              <ul aria-label="Cell states" {...stylex.props(styles.key)}>
                {cells.some((cell) => cell.kind === 'masked') && <li>× Masked</li>}
                {cells.some((cell) => cell.kind === 'missing') && <li>— Missing</li>}
                {cells.length < rows.length * columns.length && <li>· Not supplied</li>}
                {cells.some((cell) => cell.kind === 'value' && !isHeatmapValueInDomain(cell.value, domain)) && (
                  <li>! Outside domain</li>
                )}
                {isStrip && <li>Inspect a cell for its exact value</li>}
                {!isStrip &&
                  cells.some(
                    (cell) => cell.kind === 'value' && formatValue(cell.value).length > CELL_TEXT_MAX_CHARACTERS,
                  ) && <li>• Inspect a cell for its exact value</li>}
              </ul>
              <ChartReadout id={readoutId}>{inspectedLabel(items, view.inspected)}</ChartReadout>
              <ChartData
                label={`${title} cells`}
                columns={[
                  { id: 'cell', label: 'Cell' },
                  { id: 'value', label: valueLabel },
                ]}
                rows={rows.flatMap((row) =>
                  columns.map((column) => ({
                    id: JSON.stringify([row.id, column.id]),
                    values: [
                      `${row.label} → ${column.label}`,
                      matrixValueText(cellRows.get(row.id)?.get(column.id), domain, formatValue),
                    ],
                  })),
                )}
              />
            </div>
          }
        >
          {rows.length === 0 || columns.length === 0 ? (
            <p {...stylex.props(styles.empty)}>{emptyLabel}</p>
          ) : isStrip ? (
            <ChartPlot
              role="group"
              aria-label={label}
              aria-describedby={readoutId}
              {...stylex.props(styles.scroll, styles.strip, stylex.defaultMarker())}
            >
              <MatrixStrip
                rows={rows}
                columns={columns}
                cellAt={(rowId, columnId) => cellRows.get(rowId)?.get(columnId)}
                coordinateId={coordinateId}
                view={view}
                domain={domain}
                palette={palette}
                formatValue={formatValue}
                selection={selection}
              />
            </ChartPlot>
          ) : (
            <ChartPlot
              role="group"
              aria-label={label}
              aria-describedby={readoutId}
              {...stylex.props(styles.scroll, stylex.defaultMarker())}
            >
              <table {...stylex.props(styles.table)}>
                <thead>
                  <tr>
                    <th aria-label="Row" {...stylex.props(styles.label)} />
                    {columns.map((column) => (
                      <th key={column.id} scope="col" title={column.label} {...stylex.props(styles.label)}>
                        <span {...stylex.props(styles.axisText)}>{column.label}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row" title={row.label} {...stylex.props(styles.label)}>
                        <span {...stylex.props(styles.rowText)}>{row.label}</span>
                      </th>
                      {columns.map((column) => {
                        const cell = cellRows.get(row.id)?.get(column.id);

                        return (
                          <td key={column.id} {...stylex.props(styles.cell)}>
                            <MatrixValue
                              cell={cell}
                              isInspected={view.inspected === cell?.id}
                              isCursor={view.cursor === cell?.id}
                              label={`${row.label}, ${column.label}`}
                              domain={domain}
                              palette={palette}
                              formatValue={formatValue}
                              selection={selection}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </ChartPlot>
          )}
        </ChartFrame>
      )}
    />
  );
}

function MatrixValue({
  cell,
  isInspected,
  isCursor,
  label,
  domain,
  palette,
  formatValue,
  selection,
}: HeatmapScale & {
  readonly isInspected: boolean;
  readonly isCursor: boolean;
  readonly cell: MatrixCell | undefined;
  readonly label: string;
  readonly formatValue: (value: number) => string;
  readonly selection: ChartSelection | undefined;
}): ReactNode {
  if (cell === undefined) {
    return (
      <span
        role="img"
        aria-label={`${label}: not supplied`}
        title={`${label}: not supplied`}
        {...stylex.props(styles.value, styles.missing)}
      >
        ·
      </span>
    );
  }

  const isOutsideDomain = cell.kind === 'value' && !isHeatmapValueInDomain(cell.value, domain);
  const text = matrixValueText(cell, domain, formatValue);
  const accessibleLabel = `${label}: ${text}`;

  const measuredColor =
    cell.kind === 'value' && !isOutsideDomain ? heatmapColor(cell.value, { domain, palette }) : undefined;

  const isMarked = isInspected || selection?.selectedId === cell.id;

  const appearance = stylex.props(
    styles.value,
    cellStyles[cell.kind],
    measuredColor !== undefined && styles.measured(measuredColor),
    isOutsideDomain && styles.missing,
    selection !== undefined && styles.interactive,
    isMarked && styles.selected,
    !isMarked && isCursor && chartStyles.cursor,
  );

  const glyph = matrixCellGlyph(cell, text, isOutsideDomain);
  const content = cell.kind === 'value' ? <span {...stylex.props(styles.valueText)}>{glyph}</span> : glyph;

  return (
    <ChartMark
      value={cell.id}
      render={
        selection === undefined ? (
          <span role="img" />
        ) : (
          <button type="button" tabIndex={-1} aria-pressed={selection.selectedId === cell.id} />
        )
      }
      aria-label={accessibleLabel}
      title={accessibleLabel}
      {...appearance}
    >
      {content}
    </ChartMark>
  );
}

function matrixProblem({
  rows,
  columns,
  cells,
  domain,
  palette,
}: Pick<MatrixProps, 'rows' | 'columns' | 'cells' | 'domain' | 'palette'>): string | null {
  const scaleProblem = heatmapScaleProblem({ domain, palette });

  if (scaleProblem !== null) {
    return scaleProblem;
  }

  if (rows.length * columns.length > MAX_MATRIX_CELLS || cells.length > MAX_MATRIX_CELLS) {
    return `This matrix exceeds the ${MAX_MATRIX_CELLS}-cell render limit. Supply a smaller, labelled window.`;
  }

  const rowIds = new Set(rows.map((row) => row.id));
  const columnIds = new Set(columns.map((column) => column.id));

  if (!hasUniqueIds(rows) || !hasUniqueIds(columns) || !hasUniqueIds(cells)) {
    return 'Matrix rows, columns, and cells must have unique identifiers.';
  }

  const coordinates = new Map<string, Set<string>>();

  for (const cell of cells) {
    if (!rowIds.has(cell.rowId) || !columnIds.has(cell.columnId)) {
      return 'Every matrix cell must refer to a supplied row and column.';
    }

    if (cell.kind === 'value' && !Number.isFinite(cell.value)) {
      return 'Measured matrix values must be finite. Use a missing cell for unavailable values.';
    }

    const row = coordinates.get(cell.rowId) ?? new Set<string>();

    if (row.has(cell.columnId)) {
      return 'A matrix coordinate may contain only one cell.';
    }

    row.add(cell.columnId);
    coordinates.set(cell.rowId, row);
  }

  return null;
}
