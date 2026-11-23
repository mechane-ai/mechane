import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { conditions } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import type { ChartSelection } from '../chart-frame.tsx';
import { chartStyles } from '../chart-theme.ts';
import { ChartMark } from '../chart.tsx';
import type { ChartView } from '../chart.tsx';
import { heatmapColor, isHeatmapValueInDomain } from './heatmap-scale.ts';
import type { HeatmapScale } from './heatmap-scale.ts';
import { matrixCellGlyph, matrixValueText } from './matrix-cells.ts';
import type { MatrixAxisItem, MatrixCell } from './matrix-types.ts';

const styles = stylex.create({
  grid: (columnCount: number) => ({
    display: 'grid',
    gridTemplateColumns: `minmax(48px, max-content) repeat(${columnCount}, minmax(14px, 1fr))`,
    columnGap: spacing.xxs,
    rowGap: spacing.xxs,
    alignItems: 'center',
    minWidth: 0,
    fontFamily: typography.fontFamily,
  }),
  header: {
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'clip',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  row: { display: 'contents' },
  rowLabel: {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    paddingInlineEnd: spacing.sm,
    color: colors.ink,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    width: '100%',
    height: { default: 22, [conditions.coarsePointer]: 32 },
    margin: 0,
    padding: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
    lineHeight: 1,
  },
  measured: (color: string) => ({ backgroundImage: `linear-gradient(${color}, ${color})` }),
  empty: { backgroundColor: colors.canvas },
  dashed: { borderStyle: 'dashed', borderColor: colors.faint, backgroundColor: colors.canvas },
  interactive: {
    'cursor': 'pointer',
    'outlineStyle': 'none',
    ':hover': { outlineColor: { [conditions.hoverPointer]: colors.ink } },
  },
  inspected: {
    outlineWidth: controls.focusWidth,
    outlineColor: colors.focus,
    outlineStyle: 'solid',
    outlineOffset: -2,
  },
  selected: { outlineWidth: controls.focusWidth, outlineColor: colors.ink, outlineStyle: 'solid', outlineOffset: -2 },
});

type StripProps = HeatmapScale & {
  readonly rows: ReadonlyArray<MatrixAxisItem>;
  readonly columns: ReadonlyArray<MatrixAxisItem>;
  readonly cellAt: (rowId: string, columnId: string) => MatrixCell | undefined;
  readonly coordinateId: (rowId: string, columnId: string) => string;
  readonly view: ChartView;
  readonly formatValue: (value: number) => string;
  readonly selection: ChartSelection | undefined;
};

function cellAppearance({
  cell,
  domain,
  palette,
}: HeatmapScale & { readonly cell: MatrixCell | undefined }): ReadonlyArray<stylex.StyleXStyles | false> {
  if (cell === undefined) {
    return [styles.empty];
  }

  switch (cell.kind) {
    case 'masked':
      return [styles.empty];
    case 'missing':
      return [styles.dashed];
    case 'value':
      return isHeatmapValueInDomain(cell.value, domain)
        ? [styles.measured(heatmapColor(cell.value, { domain, palette }))]
        : [styles.dashed];
  }
}

function stripGlyph({
  cell,
  text,
  domain,
}: {
  readonly cell: MatrixCell | undefined;
  readonly text: string;
  readonly domain: readonly [number, number];
}): string {
  if (cell === undefined) {
    return '·';
  }

  if (cell.kind === 'value' && isHeatmapValueInDomain(cell.value, domain)) {
    return '';
  }

  return matrixCellGlyph(cell, text, cell.kind === 'value');
}

/**
 * Draws a matrix as compact intensity rows that fill the available width, such as months across categories. Cells carry
 * color and state glyphs only; inspection and the exact-value table hold the numbers.
 */
export function MatrixStrip({
  rows,
  columns,
  cellAt,
  coordinateId,
  view,
  domain,
  palette,
  formatValue,
  selection,
}: StripProps): ReactNode {
  return (
    <div {...stylex.props(styles.grid(columns.length))}>
      <span aria-hidden />
      {columns.map((column) => (
        <span key={column.id} aria-hidden title={column.label} {...stylex.props(styles.header)}>
          {column.axisLabel ?? column.label}
        </span>
      ))}
      {rows.map((row) => (
        <div key={row.id} {...stylex.props(styles.row)}>
          <span aria-hidden title={row.label} {...stylex.props(styles.rowLabel)}>
            {row.label}
          </span>
          {columns.map((column) => {
            const cell = cellAt(row.id, column.id);
            const id = cell?.id ?? coordinateId(row.id, column.id);
            const text = matrixValueText(cell, domain, formatValue);
            const label = `${row.label}, ${column.label}: ${text}`;
            const isSelected = cell !== undefined && selection?.selectedId === cell.id;
            const isResting = !isSelected && view.inspected !== id && view.cursor === id;

            const appearance = stylex.props(
              styles.cell,
              ...cellAppearance({ cell, domain, palette }),
              selection !== undefined && cell !== undefined && styles.interactive,
              view.inspected === id && styles.inspected,
              isSelected && styles.selected,
              isResting && chartStyles.cursor,
            );

            const glyph = stripGlyph({ cell, text, domain });

            return (
              <ChartMark
                key={column.id}
                value={id}
                render={
                  selection === undefined || cell === undefined ? (
                    <span role="img" />
                  ) : (
                    <button type="button" tabIndex={-1} aria-pressed={isSelected} />
                  )
                }
                aria-label={label}
                title={label}
                {...appearance}
              >
                {glyph}
              </ChartMark>
            );
          })}
        </div>
      ))}
    </div>
  );
}
