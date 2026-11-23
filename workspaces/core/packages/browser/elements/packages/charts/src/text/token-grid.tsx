import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { layers } from '../../../foundations/src/constants.stylex.ts';
import { colors, controls, shadows, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartMark, ChartPlot, inspectedLabel, plotLabel } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { isOutsideScale, tokenScaleError, tokenShade } from './token-scale.ts';
import type { TokenScale } from './token-scale.ts';
import { quoteToken, TokenScaleLegend, TokenScrollFrame, TokenText } from './token-text.tsx';

/** One position of the prompt, shown in the header row. */
export type TokenGridColumn = { readonly id: string; readonly token: string };

/** One ordered stage the predictions are read at, such as a layer. */
export type TokenGridRow = { readonly id: string; readonly label: string };

/** The prediction at one stage and position: a short token and its value, either of which may be missing. */
export type TokenGridCell = {
  readonly rowId: string;
  readonly columnId: string;
  readonly token: string | null;
  readonly value: number | null;
};

export type TokenGridProps = FigureProps &
  FigureSelectionProps &
  TokenScale & {
    /** The prompt's tokens in order. A column's position is its place in this list. */
    readonly columns: ReadonlyArray<TokenGridColumn>;
    /** The stages from top to bottom, such as layers. */
    readonly rows: ReadonlyArray<TokenGridRow>;
    /** The supplied predictions. A row and column pair with no cell is drawn hollow and read as unavailable. */
    readonly cells: ReadonlyArray<TokenGridCell>;
    /** What a cell's value measures: "Probability". */
    readonly valueLabel: string;
    readonly valueFormat: ValueFormat;
  };

/** The most cells, columns and rows `TokenGrid` draws. Every row and column pair counts as a cell. */
export const tokenGridLimits = { cells: 2400, columns: 64, rows: 64 } as const;

/** The id of the cell at a row and column, as `selected` and `onSelectedChange` name it. */
export function tokenGridCellId(rowId: string, columnId: string): string {
  return JSON.stringify([rowId, columnId]);
}

const styles = stylex.create({
  plot: { display: 'block', width: 'max-content', minWidth: '100%', outlineStyle: 'none' },
  grid: (columns: number) => ({
    display: 'grid',
    gridTemplateColumns: `max-content repeat(${columns}, minmax(3.5em, max-content))`,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
  }),
  corner: { position: 'sticky', top: 0, left: 0, zIndex: 2, backgroundColor: colors.surface },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: layers.sticky,
    display: 'grid',
    alignContent: 'end',
    paddingInline: spacing.xs,
    paddingBlockEnd: spacing.xs,
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.ink,
    backgroundColor: colors.surface,
    color: colors.ink,
  },
  position: { color: colors.muted, fontVariantNumeric: 'tabular-nums' },
  rowLabel: {
    position: 'sticky',
    left: 0,
    zIndex: layers.sticky,
    display: 'flex',
    alignItems: 'center',
    paddingInlineEnd: spacing.sm,
    whiteSpace: 'nowrap',
    color: colors.muted,
    backgroundColor: colors.surface,
  },
  cell: {
    display: 'flex',
    alignItems: 'center',
    boxSizing: 'border-box',
    maxWidth: '9em',
    minHeight: controls.height,
    overflow: 'hidden',
    paddingInline: spacing.xs,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.surface,
    color: colors.ink,
    cursor: 'default',
    scrollMarginInlineStart: '6em',
    scrollMarginBlockStart: '3em',
    scrollMarginInlineEnd: spacing.xs,
  },
  shade: (color: string) => ({ backgroundColor: color }),
  missing: { borderStyle: 'dotted', borderColor: colors.muted },
  selected: { boxShadow: shadows.selection },
  inspected: {
    outlineWidth: controls.focusWidth,
    outlineStyle: 'solid',
    outlineColor: { 'default': colors.focus, '@media (forced-colors: active)': 'Highlight' },
    outlineOffset: -2,
  },
});

function gridInputError({
  columns,
  rows,
  cells,
  domain,
  palette,
}: Pick<TokenGridProps, 'columns' | 'rows' | 'cells' | 'domain' | 'palette'>): string | undefined {
  const scaleError = tokenScaleError({ domain, palette });

  if (scaleError !== undefined) {
    return scaleError;
  }

  const isTooLarge = columns.length * rows.length > tokenGridLimits.cells;

  if (columns.length > tokenGridLimits.columns || rows.length > tokenGridLimits.rows || isTooLarge) {
    return `This grid draws at most ${tokenGridLimits.rows} rows, ${tokenGridLimits.columns} columns and ${tokenGridLimits.cells} cells. Supply fewer stages or a shorter prompt.`;
  }

  if (!hasUniqueIds(columns) || !hasUniqueIds(rows)) {
    return 'Rows and columns must have unique identifiers.';
  }

  const rowIds = new Set(rows.map((row) => row.id));
  const columnIds = new Set(columns.map((column) => column.id));
  const keys = cells.map((cell) => tokenGridCellId(cell.rowId, cell.columnId));

  if (new Set(keys).size !== keys.length) {
    return 'Each row and column pair takes at most one cell.';
  }

  if (cells.some((cell) => !rowIds.has(cell.rowId) || !columnIds.has(cell.columnId))) {
    return 'A cell names a row or column the grid does not list.';
  }

  if (cells.some((cell) => cell.value !== null && isOutsideScale(cell.value, domain))) {
    return 'A cell value is not finite or lies outside the color domain.';
  }

  return undefined;
}

/**
 * The logit-lens table: rows are layers or any ordered stage, columns are the positions of a prompt, and each cell
 * holds the token predicted there, shaded by its value. Arrow keys move cell by cell, and the readout gives the stage,
 * the position and its token, the prediction and its exact value. The grid scrolls inside its frame with its row labels
 * and header kept in view, and it suits following how a prediction forms through a model.
 */
export function TokenGrid(props: TokenGridProps): ReactNode {
  const { columns, rows, cells, valueLabel, valueFormat, domain, palette, selected, onSelectedChange, ...figure } =
    props;

  const { emptyLabel = 'No predictions are available.', ...frame } = figure;
  const { locale, title } = frame;
  const readoutId = useId();
  const linked = useLinkedInspection();

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} />;
  }

  const inputError = gridInputError({ columns, rows, cells, domain, palette });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  function valueText(value: number | null): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  const supplied = new Map(cells.map((cell) => [tokenGridCellId(cell.rowId, cell.columnId), cell]));

  const grid = rows.map((row) => ({
    row,
    cells: columns.map((column, position) => {
      const id = tokenGridCellId(row.id, column.id);
      const cell = supplied.get(id);
      const where = `${row.label}, position ${position} ${quoteToken(column.token)}`;

      if (cell === undefined) {
        return { id, cell, label: `${where}: unavailable` };
      }

      const prediction = cell.token === null ? 'prediction unavailable' : `predicts ${quoteToken(cell.token)}`;

      return { id, cell, label: `${where}: ${prediction}, ${valueLabel} ${valueText(cell.value)}` };
    }),
  }));

  const items = grid.flatMap((line) => line.cells.map((entry) => ({ id: entry.id, label: entry.label })));

  const hasMissing = grid.some((line) =>
    line.cells.some((entry) => entry.cell === undefined || entry.cell.value === null),
  );

  const isEmpty = rows.length === 0 || columns.length === 0;

  return (
    <Chart
      {...linked}
      items={items}
      columns={columns.length}
      selected={selected}
      onSelect={onSelectedChange}
      render={(figureProps, view) => (
        <FigureFrame
          {...frame}
          figure={figureProps}
          scaleLegend={
            isEmpty ? undefined : (
              <TokenScaleLegend
                label={valueLabel}
                domain={domain}
                palette={palette}
                locale={locale}
                format={valueFormat}
                hasMissing={hasMissing}
              />
            )
          }
          footer={
            isEmpty ? undefined : <ChartReadout id={readoutId}>{inspectedLabel(items, view.inspected)}</ChartReadout>
          }
        >
          {isEmpty ? (
            <FigureEmpty>{emptyLabel}</FigureEmpty>
          ) : (
            <>
              <TokenScrollFrame cursor={view.cursor} isBounded>
                <ChartPlot
                  role="group"
                  aria-label={plotLabel({ title, marks: 'cells', isSelectable: onSelectedChange !== undefined })}
                  aria-describedby={readoutId}
                  {...stylex.props(styles.plot, stylex.defaultMarker())}
                >
                  <div aria-hidden {...stylex.props(styles.grid(columns.length))}>
                    <span {...stylex.props(styles.corner)} />
                    {columns.map((column, position) => (
                      <span key={column.id} {...stylex.props(styles.header)}>
                        <span {...stylex.props(styles.position)}>{position}</span>
                        <TokenText text={column.token} shouldWrap={false} />
                      </span>
                    ))}
                    {grid.map((line) => [
                      <span key={line.row.id} {...stylex.props(styles.rowLabel)}>
                        {line.row.label}
                      </span>,
                      ...line.cells.map(({ id, cell }) => {
                        const value = cell?.value ?? null;

                        return (
                          <ChartMark
                            key={id}
                            value={id}
                            data-token-cursor={view.cursor === id ? '' : undefined}
                            {...stylex.props(
                              styles.cell,
                              value === null ? styles.missing : styles.shade(tokenShade(value, { domain, palette })),
                              view.selected === id && styles.selected,
                              view.inspected === id && styles.inspected,
                              view.cursor === id && chartStyles.cursor,
                            )}
                          >
                            {cell?.token !== undefined && cell.token !== null && (
                              <TokenText text={cell.token} shouldWrap={false} />
                            )}
                          </ChartMark>
                        );
                      }),
                    ])}
                  </div>
                </ChartPlot>
              </TokenScrollFrame>
              <ChartData
                label={`${title} predictions`}
                columns={[{ id: 'cell', label: 'Cell' }]}
                rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
              />
            </>
          )}
        </FigureFrame>
      )}
    />
  );
}
