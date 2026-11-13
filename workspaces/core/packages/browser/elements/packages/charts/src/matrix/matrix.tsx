import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { useScrollTabIndex } from '../../../foundations/src/use-scroll-tab-index.ts';
import { ChartDataDisclosure, ChartDatumButton, ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { ColorLegend } from './color-legend.tsx';
import { heatmapColor, heatmapScaleProblem, isHeatmapValueInDomain } from './heatmap-scale.ts';
import type { HeatmapScale } from './heatmap-scale.ts';

export type MatrixAxisItem = { readonly id: string; readonly label: string };

export type MatrixCell = { readonly id: string; readonly rowId: string; readonly columnId: string } & (
  | { readonly kind: 'value'; readonly value: number }
  | { readonly kind: 'masked'; readonly reason: string }
  | { readonly kind: 'missing'; readonly reason: string }
);

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
});

const cellStyles = { value: undefined, masked: styles.masked, missing: styles.missing } satisfies Record<
  MatrixCell['kind'],
  stylex.StyleXStyles | undefined
>;

export const MAX_MATRIX_CELLS = 4096;
const MAX_CELL_TEXT_LENGTH = 6;

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
}: MatrixProps): ReactNode {
  const scroll = useScrollTabIndex<HTMLDivElement>();
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

  const selected = cells.find((cell) => cell.id === selection?.selectedId);
  const selectedRow = rows.find((row) => row.id === selected?.rowId);
  const selectedColumn = columns.find((column) => column.id === selected?.columnId);

  const selectedLabel =
    selected === undefined
      ? undefined
      : `${selectedRow?.label ?? selected.rowId} → ${selectedColumn?.label ?? selected.columnId}: ${matrixValueText(selected, domain, formatValue)}`;

  return (
    <ChartFrame
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
            {cells.some((cell) => cell.kind === 'value' && formatValue(cell.value).length > MAX_CELL_TEXT_LENGTH) && (
              <li>• See exact values in View data</li>
            )}
          </ul>
          {selection !== undefined && (
            <ChartReadout>{selectedLabel ?? 'Select a cell to inspect its value.'}</ChartReadout>
          )}
          {rows.length > 0 && columns.length > 0 && (
            <ChartDataDisclosure>
              <ul {...stylex.props(styles.data)}>
                {rows.flatMap((row) =>
                  columns.map((column) => {
                    const cell = cellRows.get(row.id)?.get(column.id);
                    const label = `${row.label} → ${column.label}`;
                    const value = matrixValueText(cell, domain, formatValue);

                    return (
                      <li key={JSON.stringify([row.id, column.id])}>
                        <ChartDatumButton
                          label={`${label}: ${value}`}
                          isSelected={cell !== undefined && selection?.selectedId === cell.id}
                          onSelect={
                            cell === undefined || selection === undefined
                              ? undefined
                              : () => selection.onSelect(cell.id)
                          }
                        >
                          <span>{label}</span>
                          <span>{value}</span>
                        </ChartDatumButton>
                      </li>
                    );
                  }),
                )}
              </ul>
            </ChartDataDisclosure>
          )}
        </div>
      }
    >
      {rows.length === 0 || columns.length === 0 ? (
        <p {...stylex.props(styles.empty)}>{emptyLabel}</p>
      ) : (
        <div
          ref={scroll.ref}
          role="region"
          aria-label={`${title} cells`}
          tabIndex={scroll.tabIndex}
          {...stylex.props(styles.scroll)}
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
        </div>
      )}
    </ChartFrame>
  );
}

function MatrixValue({
  cell,
  label,
  domain,
  palette,
  formatValue,
  selection,
}: HeatmapScale & {
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

  const appearance = stylex.props(
    styles.value,
    cellStyles[cell.kind],
    measuredColor !== undefined && styles.measured(measuredColor),
    isOutsideDomain && styles.missing,
    selection !== undefined && styles.interactive,
    selection?.selectedId === cell.id && styles.selected,
  );

  const glyph = matrixCellGlyph(cell, text, isOutsideDomain);
  const content = cell.kind === 'value' ? <span {...stylex.props(styles.valueText)}>{glyph}</span> : glyph;

  if (selection === undefined) {
    return (
      <span role="img" aria-label={accessibleLabel} title={accessibleLabel} {...appearance}>
        {content}
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-label={accessibleLabel}
      title={accessibleLabel}
      aria-pressed={selection.selectedId === cell.id}
      onClick={() => selection.onSelect(cell.id)}
      {...appearance}
    >
      {content}
    </button>
  );
}

function matrixCellGlyph(cell: MatrixCell, text: string, isOutsideDomain: boolean): string {
  switch (cell.kind) {
    case 'masked':
      return '×';
    case 'missing':
      return '—';
    case 'value':
      if (isOutsideDomain) {
        return '!';
      }

      if (text.length <= MAX_CELL_TEXT_LENGTH) {
        return text;
      }

      return cell.value === 0 ? '0' : '•';
  }
}

function matrixValueText(
  cell: MatrixCell | undefined,
  domain: readonly [number, number],
  formatValue: (value: number) => string,
): string {
  if (cell === undefined) {
    return 'Not supplied';
  }

  switch (cell.kind) {
    case 'value':
      return `${formatValue(cell.value)}${isHeatmapValueInDomain(cell.value, domain) ? '' : ' (outside domain)'}`;
    case 'masked':
      return `Masked: ${cell.reason}`;
    case 'missing':
      return `Missing: ${cell.reason}`;
  }
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
