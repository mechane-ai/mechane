import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { usePlotWidth } from '../plot-width.ts';
import { fitDomain } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { BarMark, RuleMark } from '../plot/plot-marks.tsx';
import { outsideDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { distributionInputError, distributionLimits } from './distribution-input.ts';
import { groupLayout, rowsPlotHeight, segmentBetween } from './group-plot-layout.ts';
import { BandCursor, GroupFigure, useToned } from './group-plot.tsx';

/** One ranked value. `rank` is the application's own ordinal, shown before the label. */
export type RankedBarDatum = {
  readonly id: string;
  readonly label: string;
  readonly rank?: string | undefined;
  readonly value: number | null;
  readonly tone?: ChartTone | undefined;
};

export type RankedBarsProps = FigureProps &
  FigureSelectionProps & {
    /** Values in the order the application ranked them. */
    readonly items: ReadonlyArray<RankedBarDatum>;
    /** The ranked quantity, with its unit. Its domain includes zero, where every bar starts. */
    readonly value: PlotAxis;
    /** The room each row gets: `compact` fits a short ranked list in a card. */
    readonly height?: PlotHeight | undefined;
  };

const BAR_SHARE = 0.6;
const BAR_HEIGHT_MAX = 20;

function rankedInputError({
  items,
  value,
  domain,
}: Pick<RankedBarsProps, 'items' | 'value'> & { readonly domain: NumericDomain }): string | undefined {
  const error = distributionInputError({ items, domain, scale: value.scale, maxEntries: distributionLimits.rows });

  if (error !== undefined) {
    return error;
  }

  if (domain[0] > 0 || domain[1] < 0) {
    return 'The ranked-value domain must include zero.';
  }

  const outside = items.find((item) => item.value !== null && outsideDomain(item.value, domain));

  return outside === undefined
    ? undefined
    : `Ranked value ${outside.id} is non-finite or lies outside the declared domain.`;
}

/**
 * Signed or positive values in the application's ranking, one bar per row from zero: feature attributions, top error
 * sources, the largest regressions. The readout states the exact value of the row being inspected, and a measured zero
 * keeps its row.
 */
export function RankedBars(props: RankedBarsProps): ReactNode {
  const { items, value, height = 'regular', selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No ranked values are available.', ...frame } = figure;
  const { locale } = frame;
  const { ref, width } = usePlotWidth();

  const drawn = useToned(
    items.map((item) => ({ ...item, label: item.rank === undefined ? item.label : `${item.rank} · ${item.label}` })),
  );

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const observed = items.map((item) => item.value);
  const domain = value.domain ?? fitDomain({ values: observed, isZeroBased: true, scale: value.scale });
  const inputError = rankedInputError({ items, value, domain });

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
  const zero = layout.value.position(0);
  const barHeight = Math.min(layout.bandwidth * BAR_SHARE, BAR_HEIGHT_MAX);

  const chartItems = placed.map((item) => ({
    id: item.id,
    label: `${item.label}, ${value.label}: ${formatValue({ value: item.value, locale, format: value.format })}`,
  }));

  return (
    <GroupFigure
      frame={frame}
      emptyLabel={emptyLabel}
      size={{ ref, width, height: layout.box.height }}
      axes={layout}
      items={chartItems}
      locate={layout.locate}
      marksLabel="ranked values"
      selected={selected}
      onSelectedChange={onSelectedChange}
      cursor={(id) => {
        const target = placed.find((item) => item.id === id);

        return target === undefined ? null : <BandCursor {...layout.slot(target.center)} />;
      }}
      marks={(view) => (
        <>
          <RuleMark {...segmentBetween(orient.point(layout.box.top, zero), orient.point(layout.box.bottom, zero))} />
          {placed.map((item) => {
            const end = item.value === null ? zero : layout.value.position(item.value);
            const state = { isInspected: view.inspected === item.id, isSelected: view.selected === item.id };

            return item.value === 0 ? (
              <RuleMark
                key={item.id}
                {...segmentBetween(
                  orient.point(item.center - barHeight / 2, zero),
                  orient.point(item.center + barHeight / 2, zero),
                )}
                tone={item.tone}
              />
            ) : (
              item.value !== null && (
                <BarMark
                  key={item.id}
                  x={Math.min(zero, end)}
                  y={item.center - barHeight / 2}
                  width={Math.abs(end - zero)}
                  height={barHeight}
                  tone={item.tone}
                  {...state}
                />
              )
            );
          })}
        </>
      )}
    />
  );
}
