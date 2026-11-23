import * as stylex from '@stylexjs/stylex';
import { useId, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartPoint } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import type { ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps } from '../figure/figure-props.ts';
import { ColorLegend } from '../matrix/color-legend.tsx';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { axisTitle, numericPlot } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { DensityLayer } from '../plot/render/density-layer.tsx';
import { columnExtent, continuousScale, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';

/**
 * A 2D histogram the application has binned: `columns` by `rows` cells over two domains, with one count per cell, row
 * by row. Row 0 holds the lowest `y` values and column 0 the lowest `x` values. Cells divide each axis evenly in the
 * axis's scale, and the `bin2d` transform returns this shape.
 */
export type DensityHistogram = {
  readonly columns: number;
  readonly rows: number;
  readonly counts: ReadonlyArray<number>;
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
};

export type DensityMapProps = FigureProps & {
  readonly histogram: DensityHistogram;
  /** The axes the histogram was binned on. Leave their domains out: the histogram's own domains are the axes. */
  readonly x: PlotAxis;
  readonly y: PlotAxis;
  /** What each cell counts, with its unit, and how to write it: "Tokens". */
  readonly count: { readonly label: string; readonly format: ValueFormat };
  readonly height?: PlotHeight | undefined;
};

/**
 * The largest histogram the map draws, and how many non-empty cells a reader steps through one by one. Beyond that
 * many, the arrow keys step through rows instead.
 */
export const densityLimits = { columns: 512, rows: 512, cellItems: 1024 } as const;

const styles = stylex.create({ outline: { fill: 'none', pointerEvents: 'none' } });

type DensityCell = { readonly id: string; readonly column: number; readonly row: number; readonly count: number };

type DensityRow = { readonly row: number; readonly total: number; readonly peak: DensityCell | undefined };

type GridSummary = {
  readonly filled: ReadonlyArray<DensityCell>;
  readonly rows: ReadonlyArray<DensityRow>;
  readonly maximum: number;
};

/** Reads every count once: the non-empty cells, each row's total and peak, and the largest count. */
function summarizeGrid({ counts, columns, rows }: Pick<DensityHistogram, 'counts' | 'columns' | 'rows'>): GridSummary {
  const width = Math.max(1, columns);

  const filled = counts.flatMap((value, index): ReadonlyArray<DensityCell> => {
    const column = index % width;
    const row = Math.floor(index / width);

    return value > 0 ? [{ id: `${column}:${row}`, column, row, count: value }] : [];
  });

  const totals = new Float64Array(Math.max(0, rows));
  const peaks: Array<DensityCell | undefined> = Array.from({ length: Math.max(0, rows) }, () => undefined);

  for (const cell of filled) {
    totals[cell.row] = (totals[cell.row] ?? 0) + cell.count;

    if (cell.count > (peaks[cell.row]?.count ?? 0)) {
      peaks[cell.row] = cell;
    }
  }

  return {
    filled,
    rows: Array.from(totals, (total, row) => ({ row, total, peak: peaks[row] })),
    maximum: columnExtent(counts)?.[1] ?? 0,
  };
}

function sameDomain(axis: PlotAxis, domain: NumericDomain): boolean {
  return axis.domain === undefined || (axis.domain[0] === domain[0] && axis.domain[1] === domain[1]);
}

function densityInputError({ histogram, x, y }: Pick<DensityMapProps, 'histogram' | 'x' | 'y'>): string | undefined {
  const { columns, rows, counts, xDomain, yDomain } = histogram;
  const domainError = scaleDomainError(xDomain, x.scale) ?? scaleDomainError(yDomain, y.scale);

  if (domainError !== undefined) {
    return domainError;
  }

  if (!sameDomain(x, xDomain) || !sameDomain(y, yDomain)) {
    return "An axis domain must match the histogram's domain. Leave the axis domain out to use it.";
  }

  const isGrid = [columns, rows].every((side) => Number.isInteger(side) && side > 0);

  if (!isGrid || columns > densityLimits.columns || rows > densityLimits.rows) {
    return `A density map needs whole numbers of columns and rows, at most ${densityLimits.columns} by ${densityLimits.rows}.`;
  }

  if (counts.length !== columns * rows) {
    return `The histogram needs ${columns * rows} counts, one per cell; it has ${counts.length}.`;
  }

  if (counts.some((value) => !Number.isFinite(value) || value < 0)) {
    return 'Every count must be a finite value of zero or more.';
  }

  return undefined;
}

/**
 * A 2D histogram as a grid of cells, darker where more items fall: where activations cluster across two features, how
 * latency spreads against payload size. The application bins the data, and the map draws up to 512 by 512 cells on
 * canvas. It names the exact count of the cell under the pointer or the keyboard cursor and keys its shades in a
 * legend.
 */
export function DensityMap(props: DensityMapProps): ReactNode {
  const { histogram, x, y, count, height = 'tall', ...figure } = props;
  const { emptyLabel = 'No counts are available.', ...frame } = figure;
  const { locale, title } = frame;
  const { columns, rows, counts, xDomain, yDomain } = histogram;
  const size = usePlotSize(height);
  const readoutId = useId();

  // A 512 by 512 histogram holds a quarter of a million counts, so the cells are read only when they change.
  const summary = useMemo(() => summarizeGrid({ counts, columns, rows }), [counts, columns, rows]);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const inputError = densityInputError({ histogram, x, y });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const plot = numericPlot({ width: size.width, height: size.height, x, y, xDomain, yDomain, locale });
  const { box } = plot;
  const { filled, maximum } = summary;
  const xEdges = continuousScale({ type: x.scale, domain: xDomain, range: [0, columns] });
  const yEdges = continuousScale({ type: y.scale, domain: yDomain, range: [0, rows] });
  const cellWidth = box.innerWidth / columns;
  const cellHeight = box.innerHeight / rows;
  const isByCell = filled.length <= densityLimits.cellItems;

  function countText(value: number): string {
    return formatValue({ value, locale, format: count.format });
  }

  function xSpan(column: number): string {
    const low = formatValue({ value: xEdges.valueAt(column), locale, format: x.format });
    const high = formatValue({ value: xEdges.valueAt(column + 1), locale, format: x.format });

    return `${x.label} ${low} – ${high}`;
  }

  function ySpan(row: number): string {
    const low = formatValue({ value: yEdges.valueAt(row), locale, format: y.format });
    const high = formatValue({ value: yEdges.valueAt(row + 1), locale, format: y.format });

    return `${y.label} ${low} – ${high}`;
  }

  const rowItems = summary.rows.flatMap((line) =>
    line.peak === undefined
      ? []
      : [
          {
            id: `row:${line.row}`,
            row: line.row,
            label: `${ySpan(line.row)}: ${count.label} ${countText(line.total)} in all, at most ${countText(line.peak.count)} at ${xSpan(line.peak.column)}`,
          },
        ],
  );

  const items = isByCell
    ? filled.map((cell) => ({
        id: cell.id,
        label: `${xSpan(cell.column)}, ${ySpan(cell.row)}: ${count.label} ${countText(cell.count)}`,
      }))
    : rowItems.map((item) => ({ id: item.id, label: item.label }));

  const cellsById = new Map(filled.map((cell) => [cell.id, cell]));
  const rowsById = new Map(rowItems.map((item) => [item.id, item.row]));

  function locate(point: ChartPoint): string | undefined {
    const column = Math.floor((((point.x / point.width) * box.width - box.left) / box.innerWidth) * columns);
    const row = rows - 1 - Math.floor((((point.y / point.height) * box.height - box.top) / box.innerHeight) * rows);
    const isColumnInside = column >= 0 && column < columns;
    const isRowInside = row >= 0 && row < rows;

    if (!isColumnInside || !isRowInside) {
      return undefined;
    }

    return isByCell ? `${column}:${row}` : `row:${row}`;
  }

  /** Where an item sits on screen: one cell, or a whole row. */
  function outline(id: string | null): { readonly x: number; readonly y: number; readonly width: number } | undefined {
    const cell = id === null ? undefined : cellsById.get(id);
    const row = id === null ? undefined : rowsById.get(id);

    if (cell !== undefined) {
      return { x: box.left + cell.column * cellWidth, y: box.bottom - (cell.row + 1) * cellHeight, width: cellWidth };
    }

    return row === undefined
      ? undefined
      : { x: box.left, y: box.bottom - (row + 1) * cellHeight, width: box.innerWidth };
  }

  return (
    <Chart
      items={items}
      locate={locate}
      place={
        isByCell
          ? (id) => {
              const cell = cellsById.get(id);

              return cell === undefined
                ? undefined
                : { left: cell.column, right: cell.column + 1, top: rows - cell.row - 1, bottom: rows - cell.row };
            }
          : undefined
      }
      arrows="both"
      render={(figureProps, { inspected, cursor }) => {
        const inspectedBox = outline(inspected);
        const cursorBox = outline(cursor);

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            scaleLegend={
              filled.length === 0 ? undefined : (
                <ColorLegend
                  label={count.label}
                  domain={[0, maximum]}
                  palette="sequential"
                  valueFormat={count.format}
                  locale={locale}
                />
              )
            }
            footer={
              filled.length === 0 ? undefined : (
                <ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>
              )
            }
          >
            {filled.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={size.ref}
                  box={box}
                  label={plotLabel({ title, marks: isByCell ? 'cells' : 'rows', isSelectable: false })}
                  readoutId={readoutId}
                  overlay={
                    <>
                      <DensityLayer box={box} columns={columns} rows={rows} counts={counts} maximum={maximum} />
                      <svg
                        aria-hidden
                        width={box.width}
                        height={box.height}
                        viewBox={`0 0 ${box.width} ${box.height}`}
                        {...stylex.props(chartStyles.svg)}
                      >
                        <PlotClip box={box}>
                          {inspectedBox !== undefined && (
                            <rect
                              x={inspectedBox.x}
                              y={inspectedBox.y}
                              width={inspectedBox.width}
                              height={cellHeight}
                              {...stylex.props(styles.outline, chartStyles.selected)}
                            />
                          )}
                          {cursorBox !== undefined && (
                            <rect
                              x={cursorBox.x}
                              y={cursorBox.y}
                              width={cursorBox.width}
                              height={cellHeight}
                              {...stylex.props(styles.outline, chartStyles.shapeCursor)}
                            />
                          )}
                        </PlotClip>
                      </svg>
                    </>
                  }
                >
                  <PlotAxes
                    box={box}
                    xTicks={plot.xTicks}
                    yTicks={plot.yTicks}
                    xTitle={axisTitle(x)}
                    yTitle={axisTitle(y)}
                    grid="none"
                  />
                </PlotSurface>
                <ChartData
                  label={`${title} ${isByCell ? 'cells' : 'rows'}`}
                  columns={[{ id: 'item', label: isByCell ? 'Cell' : 'Row' }]}
                  rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
                />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
