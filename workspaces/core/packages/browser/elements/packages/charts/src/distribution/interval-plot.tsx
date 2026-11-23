import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { usePlotWidth } from '../plot-width.ts';
import { fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, IntervalMark } from '../plot/plot-marks.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { distributionInputError, distributionLimits } from './distribution-input.ts';
import { groupLayout, rowsPlotHeight, segmentBetween } from './group-plot-layout.ts';
import type { Vertex } from './group-plot-layout.ts';
import { BandCursor, GroupFigure, useToned } from './group-plot.tsx';

/** One prepared estimate with its interval. A null bound or estimate stays unavailable and is not drawn. */
export type IntervalDatum = {
  readonly id: string;
  readonly label: string;
  readonly lower: number | null;
  readonly estimate: number | null;
  readonly upper: number | null;
  readonly tone?: ChartTone | undefined;
};

export type IntervalPlotProps = FigureProps &
  FigureSelectionProps & {
    readonly items: ReadonlyArray<IntervalDatum>;
    /** The estimated quantity, with its unit. */
    readonly value: PlotAxis;
    /** What the interval is, as the application computed it: "95% bootstrap interval". */
    readonly intervalLabel: string;
    /** The room each row gets: `compact` fits a short list in a card. */
    readonly height?: PlotHeight | undefined;
  };

const CAP_HALF = 5;
const DOT_RADIUS = 4;

function intervalInputError({
  items,
  value,
  domain,
}: Pick<IntervalPlotProps, 'items' | 'value'> & { readonly domain: NumericDomain }): string | undefined {
  const error = distributionInputError({ items, domain, scale: value.scale, maxEntries: distributionLimits.rows });

  if (error !== undefined) {
    return error;
  }

  for (const item of items) {
    const values = [item.lower, item.estimate, item.upper];

    if (values.some((amount) => amount !== null && outsideDomain(amount, domain))) {
      return `Interval ${item.id} has a non-finite value or lies outside the declared domain.`;
    }

    if (item.lower !== null && item.upper !== null && item.lower > item.upper) {
      return `Interval ${item.id} has reversed endpoints.`;
    }

    if (item.estimate !== null) {
      if (item.lower !== null && item.estimate < item.lower) {
        return `Interval ${item.id} has an estimate below its lower endpoint.`;
      }

      if (item.upper !== null && item.estimate > item.upper) {
        return `Interval ${item.id} has an estimate above its upper endpoint.`;
      }
    }
  }

  return undefined;
}

/**
 * Prepared estimates with their intervals, one row each: model accuracy with a bootstrap interval, an effect with its
 * confidence bounds. The rows keep the supplied order, and the readout states the exact values of the row being
 * inspected.
 */
export function IntervalPlot(props: IntervalPlotProps): ReactNode {
  const { items, value, intervalLabel, height = 'regular', selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No interval estimates are available.', ...frame } = figure;
  const { locale } = frame;
  const { ref, width } = usePlotWidth();
  const drawn = useToned(items);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const observed = items.flatMap((item) => [item.lower, item.estimate, item.upper]);
  const domain = value.domain ?? fitDomain({ values: observed, scale: value.scale });
  const inputError = intervalInputError({ items, value, domain });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const layout = groupLayout({
    width,
    height: rowsPlotHeight({ height, count: items.length }),
    direction: 'rows',
    groups: drawn,
    value,
    valueDomain: domain,
    locale,
  });

  const { orient, placed } = layout;

  function at(across: number, amount: number): Vertex {
    return orient.point(across, layout.value.position(amount));
  }

  function text(amount: number | null): string {
    return formatValue({ value: amount, locale, format: value.format });
  }

  const chartItems = placed.map((item) => {
    const estimate = item.estimate === null ? 'Estimate unavailable' : text(item.estimate);

    return {
      id: item.id,
      label: `${item.label}, ${value.label}: ${estimate}, ${intervalLabel}: ${text(item.lower)} – ${text(item.upper)}`,
    };
  });

  return (
    <GroupFigure
      frame={frame}
      emptyLabel={emptyLabel}
      size={{ ref, width, height: layout.box.height }}
      axes={layout}
      items={chartItems}
      locate={layout.locate}
      marksLabel="estimates"
      selected={selected}
      onSelectedChange={onSelectedChange}
      note={`The dot is the estimate. The line is the ${intervalLabel}.`}
      cursor={(id) => {
        const target = placed.find((item) => item.id === id);

        return target === undefined ? null : <BandCursor {...layout.slot(target.center)} />;
      }}
      marks={(view) =>
        placed.map((item) => {
          const { center } = item;
          const state = { isInspected: view.inspected === item.id, isSelected: view.selected === item.id };

          return (
            <g key={item.id}>
              {item.lower !== null && item.upper !== null && (
                <>
                  <IntervalMark {...segmentBetween(at(center, item.lower), at(center, item.upper))} tone={item.tone} />
                  <IntervalMark
                    {...segmentBetween(at(center - CAP_HALF, item.lower), at(center + CAP_HALF, item.lower))}
                    tone={item.tone}
                  />
                  <IntervalMark
                    {...segmentBetween(at(center - CAP_HALF, item.upper), at(center + CAP_HALF, item.upper))}
                    tone={item.tone}
                  />
                </>
              )}
              {item.estimate !== null && (
                <DotMark {...at(center, item.estimate)} tone={item.tone} radius={DOT_RADIUS} {...state} />
              )}
            </g>
          );
        })
      }
    />
  );
}
