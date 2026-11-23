import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartLegend, ChartReadout } from '../chart-frame.tsx';
import type { ChartLegendItem } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartItem } from '../chart.tsx';
import { FigureEmpty, FigureFrame } from '../figure/figure-frame.tsx';
import type { FigureFrameInput, FigureSelectionProps } from '../figure/figure-props.ts';
import { locateNearest } from '../plot/locate.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import type { PlotGrid } from '../plot/plot-axes.tsx';
import { axisTitle, categoryPlot, plotHeights } from '../plot/plot-layout.ts';
import type { CategoryPlotLayout, PlotAxis, PlotCategory, PlotHeight } from '../plot/plot-layout.ts';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';

/** The room above and below the rows that the plot keeps for its margins and the axis title, in pixels. */
const PLOT_CHROME = 56;

/** The height one row gets when it holds a single dot or bar, in pixels. */
export const ROW_STEP = 28;

const styles = stylex.create({
  inspected: { fill: colors.canvas },
  selected: { fill: colors.line },
  pointerless: { pointerEvents: 'none' },
  cursor: { fill: 'none' },
});

export type ComparisonRowsInput = {
  readonly rows: ReadonlyArray<PlotCategory>;
  readonly value: PlotAxis;
  /** The resolved value domain: the axis's own, or the result of `fitDomain`. */
  readonly valueDomain: NumericDomain;
  /** The most rows the chart draws. */
  readonly rowsMax: number;
};

/** The first thing wrong with a comparison chart's rows or value axis, or undefined when they can be drawn. */
export function comparisonRowsError({ rows, value, valueDomain, rowsMax }: ComparisonRowsInput): string | undefined {
  const domainError = scaleDomainError(valueDomain, value.scale);

  if (domainError !== undefined) {
    return domainError;
  }

  if (!hasUniqueIds(rows)) {
    return 'Rows must have unique identifiers.';
  }

  if (rows.length > rowsMax) {
    return `This chart draws at most ${rowsMax} rows. Supply the leading rows or group the rest.`;
  }

  return undefined;
}

/** Every key of a record that names no row. A chart rejects values for rows it does not list. */
export function unknownRowIds(rows: ReadonlyArray<PlotCategory>, keys: ReadonlyArray<string>): ReadonlyArray<string> {
  const known = new Set(rows.map((row) => row.id));

  return keys.filter((key) => !known.has(key));
}

/** What a chart draws its marks from: the layout, and the rows that are inspected, selected or under the cursor. */
export type ComparisonState = {
  readonly plot: CategoryPlotLayout;
  readonly inspected: string | undefined;
  readonly selected: string | undefined;
};

export type ComparisonFigureProps = FigureSelectionProps & {
  /** The shared figure props: title, description, locale, source and the rest. */
  readonly frame: FigureFrameInput;
  /** True when there is nothing to draw. The figure then shows `emptyLabel` in place of the plot. */
  readonly isEmpty: boolean;
  readonly emptyLabel: string;
  readonly rows: ReadonlyArray<PlotCategory>;
  readonly value: PlotAxis;
  readonly valueDomain: NumericDomain;
  readonly height: PlotHeight;
  /** The height each row needs, in pixels. The plot grows with its rows and never shrinks below its named height. */
  readonly rowStep: number;
  /** One per row, with the row's id: the sentence that gives its exact values. */
  readonly items: ReadonlyArray<ChartItem>;
  readonly legend: ReadonlyArray<ChartLegendItem>;
  /** True to show the legend in the frame's legend slot above the plot. */
  readonly hasLegend: boolean;
  /** Which lines run across the plot. Value lines are vertical; row lines are horizontal. */
  readonly grid: PlotGrid;
  /** Draws the marks of every row inside the axes. */
  readonly renderMarks: (state: ComparisonState) => ReactNode;
};

/**
 * The plot every comparison chart shares: named rows down the side, one measured value along the bottom, a readout of
 * the inspected row, and the keyboard cursor and selection. A chart supplies its rows, its sentences and its marks.
 */
export function ComparisonFigure({
  frame,
  isEmpty,
  emptyLabel,
  rows,
  value,
  valueDomain,
  height,
  rowStep,
  items,
  legend,
  hasLegend,
  grid,
  selected,
  onSelectedChange,
  renderMarks,
}: ComparisonFigureProps): ReactNode {
  const size = usePlotSize(height);
  const readoutId = useId();
  const link = useLinkedInspection();
  const plotHeight = Math.max(plotHeights[height], rows.length * rowStep + PLOT_CHROME);

  const plot = categoryPlot({
    width: size.width,
    height: plotHeight,
    direction: 'rows',
    categories: rows,
    value,
    valueDomain,
    locale: frame.locale,
  });

  const { box, band } = plot;

  const marks = rows.flatMap((row) => {
    const y = band.center(row.id);

    return y === undefined ? [] : [{ id: row.id, x: 0, y }];
  });

  return (
    <Chart
      {...link}
      items={items}
      arrows="both"
      locate={locateNearest({ marks, width: box.width, height: box.height, axis: 'y' })}
      selected={selected}
      onSelect={onSelectedChange}
      render={(figure, view) => {
        const inspected = items.find((item) => item.id === view.inspected)?.id;
        const chosen = items.find((item) => item.id === view.selected)?.id;
        const cursor = items.find((item) => item.id === view.cursor)?.id;

        function rowFrame(id: string): { readonly y: number; readonly height: number } {
          return { y: (band.start(id) ?? 0) - (band.step - band.bandwidth) / 2, height: band.step };
        }

        return (
          <FigureFrame
            {...frame}
            figure={figure}
            series={legend}
            seriesLegend={hasLegend && !isEmpty ? <ChartLegend items={legend} /> : undefined}
            footer={
              isEmpty ? undefined : (
                <ChartReadout id={readoutId}>{inspectedLabel(items, inspected ?? null)}</ChartReadout>
              )
            }
          >
            {isEmpty ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={size.ref}
                  box={box}
                  label={plotLabel({ title: frame.title, marks: 'rows', isSelectable: onSelectedChange !== undefined })}
                  readoutId={readoutId}
                >
                  {rows
                    .filter((row) => row.id === inspected || row.id === chosen)
                    .map((row) => (
                      <rect
                        key={row.id}
                        x={box.left}
                        width={box.innerWidth}
                        {...rowFrame(row.id)}
                        {...stylex.props(styles.pointerless, styles.inspected, row.id === chosen && styles.selected)}
                      />
                    ))}
                  <PlotAxes
                    box={box}
                    xTicks={plot.valueTicks}
                    yTicks={plot.bandTicks}
                    xTitle={axisTitle(value)}
                    grid={grid}
                  />
                  <PlotClip box={box}>{renderMarks({ plot, inspected, selected: chosen })}</PlotClip>
                  {cursor !== undefined && (
                    <rect
                      x={box.left}
                      width={box.innerWidth}
                      {...rowFrame(cursor)}
                      {...stylex.props(styles.pointerless, styles.cursor, chartStyles.cursor)}
                    />
                  )}
                </PlotSurface>
                <ChartData
                  label={`${frame.title} comparison`}
                  columns={[{ id: 'row', label: 'Row' }]}
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
