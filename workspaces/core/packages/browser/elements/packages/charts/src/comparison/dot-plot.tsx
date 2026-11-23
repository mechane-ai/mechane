import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedHighlight } from '../chart-link.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotCategory, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, IntervalMark } from '../plot/plot-marks.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { ComparisonFigure, comparisonRowsError, ROW_STEP, unknownRowIds } from './comparison-plot.tsx';

/** The bounds of an interval around a value, such as a confidence interval. */
export type DotPlotInterval = { readonly lower: number; readonly upper: number };

export type DotPlotSeries = {
  readonly id: string;
  readonly label: string;
  readonly tone?: ChartTone | undefined;
  /** The value of each row, by row id. A row left out or set to null has no value and draws no dot. */
  readonly values: Readonly<Record<string, number | null>>;
  /** The interval around each row's value, by row id. It is drawn behind the dot. */
  readonly intervals?: Readonly<Record<string, DotPlotInterval>> | undefined;
};

export type DotPlotProps = FigureProps &
  FigureSelectionProps & {
    /** The categories compared, listed down the side in the order given. */
    readonly rows: ReadonlyArray<PlotCategory>;
    readonly series: ReadonlyArray<DotPlotSeries>;
    /** The measured axis. Position carries the value, so it need not start at zero. */
    readonly value: PlotAxis;
    /**
     * The series drawn at full strength while the others fade. Emphasis only. Left out, it follows the enclosing chart
     * link: a table row or a term in the prose that inspects a series id highlights that series.
     */
    readonly highlighted?: string | null | undefined;
    readonly height?: PlotHeight | undefined;
  };

export const dotPlotLimits = { rows: 60, series: 6 } as const;

const DOT_RADIUS = 4;
const DODGE_STEP = 9;
const ROW_PADDING = 12;

function dotPlotInputError({
  rows,
  series,
  value,
  valueDomain,
}: DotPlotProps & { readonly valueDomain: NumericDomain }): string | undefined {
  const rowsError = comparisonRowsError({ rows, value, valueDomain, rowsMax: dotPlotLimits.rows });

  if (rowsError !== undefined) {
    return rowsError;
  }

  if (!hasUniqueIds(series)) {
    return 'Series must have unique identifiers.';
  }

  if (series.length > dotPlotLimits.series) {
    return `This chart draws at most ${dotPlotLimits.series} series.`;
  }

  for (const item of series) {
    const keys = [...Object.keys(item.values), ...Object.keys(item.intervals ?? {})];

    if (unknownRowIds(rows, keys).length > 0) {
      return `Series ${item.id} has values for rows that are not listed.`;
    }

    const bounds = Object.values(item.intervals ?? {}).flatMap((interval) => [interval.lower, interval.upper]);

    if (
      [...Object.values(item.values), ...bounds].some((amount) => amount !== null && outsideDomain(amount, valueDomain))
    ) {
      return `Series ${item.id} has a value that is not finite or lies outside the declared domain.`;
    }

    if (Object.values(item.intervals ?? {}).some((interval) => interval.lower > interval.upper)) {
      return `Series ${item.id} has an interval whose lower bound is above its upper bound.`;
    }
  }

  return undefined;
}

/**
 * One dot per series on each row, along one shared measured axis: a Cleveland dot plot. Use it to compare named
 * categories, such as the accuracy of several models per task, when position reads better than bar length and the axis
 * need not start at zero. An optional interval is drawn behind its dot, and the application supplies every value.
 */
export function DotPlot(props: DotPlotProps): ReactNode {
  const { rows, series, value, highlighted, selected, onSelectedChange, height = 'regular', ...figure } = props;
  const { emptyLabel = 'No values are available.', ...frame } = figure;
  const { locale } = frame;
  const tones = useTones();
  const focused = useLinkedHighlight({ ids: series.map((item) => item.id), highlighted });

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const valueDomain =
    value.domain ??
    fitDomain({
      values: series.flatMap((item) => [
        ...Object.values(item.values),
        ...Object.values(item.intervals ?? {}).flatMap((interval) => [interval.lower, interval.upper]),
      ]),
      scale: value.scale,
    });

  const inputError = dotPlotInputError({ ...props, valueDomain });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const drawn = series.map((item, index) => ({ ...item, tone: tones({ id: item.id, tone: item.tone, index }) }));

  function text(number: number | null): string {
    return formatValue({ value: number, locale, format: value.format });
  }

  const items = rows.map((row) => {
    const parts = drawn.map((item) => {
      const interval = item.intervals?.[row.id];
      const range = interval === undefined ? '' : ` (${text(interval.lower)} – ${text(interval.upper)})`;

      return `${item.label}: ${text(item.values[row.id] ?? null)}${range}`;
    });

    return { id: row.id, label: [row.label, ...parts].join(' · ') };
  });

  return (
    <ComparisonFigure
      frame={frame}
      isEmpty={rows.length === 0 || series.length === 0}
      emptyLabel={emptyLabel}
      rows={rows}
      value={value}
      valueDomain={valueDomain}
      height={height}
      rowStep={Math.max(ROW_STEP, drawn.length * DODGE_STEP + ROW_PADDING)}
      items={items}
      legend={drawn.map((item) => ({ id: item.id, label: item.label, tone: item.tone }))}
      hasLegend={drawn.length > 1}
      grid="both"
      selected={selected}
      onSelectedChange={onSelectedChange}
      renderMarks={({ plot, inspected, selected: chosen }) =>
        rows.flatMap((row) => {
          const center = plot.band.center(row.id);

          if (center === undefined) {
            return [];
          }

          return [
            <g key={row.id}>
              {drawn.map((item, index) => {
                const position = item.values[row.id];
                const interval = item.intervals?.[row.id];
                const y = center + (index - (drawn.length - 1) / 2) * DODGE_STEP;
                const emphasis = focused === null || item.id === focused ? 'normal' : 'receded';

                return (
                  <g key={item.id}>
                    {interval !== undefined && typeof position === 'number' && (
                      <IntervalMark
                        x1={plot.value.position(interval.lower)}
                        x2={plot.value.position(interval.upper)}
                        y1={y}
                        y2={y}
                        tone={item.tone}
                        emphasis={emphasis}
                      />
                    )}
                    {typeof position === 'number' && (
                      <DotMark
                        x={plot.value.position(position)}
                        y={y}
                        tone={item.tone}
                        radius={DOT_RADIUS}
                        emphasis={emphasis}
                        isInspected={row.id === inspected}
                        isSelected={row.id === chosen}
                      />
                    )}
                  </g>
                );
              })}
            </g>,
          ];
        })
      }
    />
  );
}
