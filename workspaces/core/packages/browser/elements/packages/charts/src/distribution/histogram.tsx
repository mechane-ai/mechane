import type { ReactNode } from 'react';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { Chart } from '../chart.tsx';
import { formatValue } from '../figure/figure-format.ts';
import { FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { fitDomain, numericPlot } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { BarMark } from '../plot/plot-marks.tsx';
import { usePlotSize } from '../plot/plot-surface.tsx';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { distributionInputError, distributionLimits } from './distribution-input.ts';
import { DistributionFigure } from './distribution-plot.tsx';

/** One prepared bin: its bounds on the value axis and the number of observations in it, or null when unrecorded. */
export type HistogramBin = {
  readonly id: string;
  readonly label: string;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly count: number | null;
};

export type HistogramProps = FigureProps &
  FigureSelectionProps & {
    /** Bins in increasing order that do not overlap. The application computes them. */
    readonly bins: ReadonlyArray<HistogramBin>;
    /** The measured variable the bins divide, with its unit. */
    readonly value: PlotAxis;
    /** The count axis. It starts at zero; leave its domain out to fit the largest count. */
    readonly count: PlotAxis;
    readonly tone?: ChartTone | undefined;
    readonly height?: PlotHeight | undefined;
  };

const BIN_GAP = 2;
const BIN_GAP_SHARE = 0.2;
const MISSING_HEIGHT = 5;

function histogramInputError({
  bins,
  value,
  count,
  valueDomain,
  countDomain,
}: Pick<HistogramProps, 'bins' | 'value' | 'count'> & {
  readonly valueDomain: NumericDomain;
  readonly countDomain: NumericDomain;
}): string | undefined {
  const error =
    distributionInputError({
      items: bins,
      domain: valueDomain,
      scale: value.scale,
      maxEntries: distributionLimits.bins,
    }) ?? scaleDomainError(countDomain, count.scale);

  if (error !== undefined) {
    return error;
  }

  if (countDomain[0] !== 0) {
    return 'The histogram count axis must start at zero.';
  }

  for (const [index, bin] of bins.entries()) {
    if (outsideDomain(bin.lowerBound, valueDomain) || outsideDomain(bin.upperBound, valueDomain)) {
      return `Histogram bin ${bin.id} has a non-finite bound or lies outside the declared domain.`;
    }

    const previous = bins[index - 1];

    if (bin.lowerBound >= bin.upperBound || (previous !== undefined && bin.lowerBound < previous.upperBound)) {
      return `Histogram bin ${bin.id} is reversed, overlaps another bin, or is out of order.`;
    }

    if (bin.count !== null && outsideDomain(bin.count, countDomain)) {
      return `Histogram bin ${bin.id} has a count outside the declared count domain.`;
    }
  }

  return undefined;
}

/**
 * Counts of observations in prepared bins along a measured value, such as request latency or token length. Bars start
 * at zero; a bin with no recorded count is drawn hollow, never as zero. Use `ECDF` to read cumulative shares instead.
 */
export function Histogram(props: HistogramProps): ReactNode {
  const { bins, value, count, tone = 'series1', height = 'regular', selected, onSelectedChange, ...figure } = props;
  const { emptyLabel = 'No histogram bins are available.', ...frame } = figure;
  const { locale } = frame;
  const size = usePlotSize(height);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const bounds = bins.flatMap((bin) => [bin.lowerBound, bin.upperBound]);
  const valueDomain = value.domain ?? fitDomain({ values: bounds, scale: value.scale });
  const counts = bins.map((bin) => bin.count);
  const countDomain = count.domain ?? fitDomain({ values: counts, isZeroBased: true, scale: count.scale });
  const inputError = histogramInputError({ bins, value, count, valueDomain, countDomain });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const plot = numericPlot({
    width: size.width,
    height: size.height,
    x: value,
    y: count,
    xDomain: valueDomain,
    yDomain: countDomain,
    locale,
  });

  const { box } = plot;

  function valueText(amount: number | null): string {
    return formatValue({ value: amount, locale, format: value.format });
  }

  const items = bins.map((bin) => ({
    id: bin.id,
    label: `${bin.label}, ${valueText(bin.lowerBound)} – ${valueText(bin.upperBound)}, ${count.label}: ${formatValue({ value: bin.count, locale, format: count.format })}`,
  }));

  return (
    <Chart
      items={items}
      arrows="both"
      locate={(point) => {
        const at = plot.x.valueAt((point.x / point.width) * box.width);

        return bins.find((bin) => at >= bin.lowerBound && at <= bin.upperBound)?.id;
      }}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, view) => {
        const rest = bins.find((bin) => bin.id === view.cursor);

        return (
          <DistributionFigure
            frame={frame}
            figure={figureProps}
            items={items}
            inspected={view.inspected}
            plotRef={size.ref}
            plot={plot}
            x={value}
            y={count}
            isSelectable={onSelectedChange !== undefined}
            emptyLabel={emptyLabel}
            overlay={
              rest !== undefined && (
                <ChartCursor
                  x={(plot.x.position(rest.lowerBound) + plot.x.position(rest.upperBound)) / 2}
                  top={box.top}
                  bottom={box.bottom}
                  width={plot.x.position(rest.upperBound) - plot.x.position(rest.lowerBound)}
                />
              )
            }
          >
            {bins.map((bin) => {
              const left = plot.x.position(bin.lowerBound);
              const width = plot.x.position(bin.upperBound) - left;
              const gap = Math.min(BIN_GAP, width * BIN_GAP_SHARE);
              const isSelected = view.selected === bin.id;
              const isInspected = view.inspected === bin.id;
              const isFocused = view.selected === null || isSelected || isInspected;
              const top = bin.count === null ? box.bottom - MISSING_HEIGHT : plot.y.position(bin.count);

              return (
                <BarMark
                  key={bin.id}
                  x={left + gap / 2}
                  y={top}
                  width={width - gap}
                  height={box.bottom - top}
                  tone={tone}
                  isHollow={bin.count === null}
                  emphasis={isFocused ? 'normal' : 'receded'}
                  isSelected={isSelected}
                  isInspected={isInspected}
                />
              );
            })}
          </DistributionFigure>
        );
      }}
    />
  );
}
