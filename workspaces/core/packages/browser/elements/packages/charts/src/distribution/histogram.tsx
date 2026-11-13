import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import type { ReactNode } from 'react';
import { ChartDataDisclosure, ChartDatumButton, ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { chartToneColors } from '../chart-theme.ts';
import type { ChartTone } from '../chart-theme.ts';
import { distributionInputError, distributionLimits, outsideDomain } from './distribution-input.ts';
import type { NumericDomain } from './distribution-input.ts';
import { distributionGeometry, distributionStyles, NumericPlot } from './distribution-plot.tsx';

export type HistogramBin = {
  readonly id: string;
  readonly label: string;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly count: number | null;
};

export type HistogramProps = {
  readonly title: string;
  readonly report?: ChartReport | undefined;
  readonly description?: string;
  readonly bins: ReadonlyArray<HistogramBin>;
  readonly domain: NumericDomain;
  readonly maximumCount: number;
  readonly valueLabel: string;
  readonly countLabel: string;
  readonly formatValue: (value: number) => string;
  readonly formatCount: (count: number) => string;
  readonly tone?: ChartTone;
  readonly selection?: ChartSelection;
  readonly emptyLabel?: string;
};

export function Histogram({
  title,
  report,
  description,
  bins,
  domain,
  maximumCount,
  valueLabel,
  countLabel,
  formatValue,
  formatCount,
  tone = 'series1',
  selection,
  emptyLabel = 'No histogram bins are available.',
}: HistogramProps): ReactNode {
  const inputError = histogramInputError({ bins, domain, maximumCount });

  if (inputError !== undefined) {
    return <ChartInputError title={title} report={report} description={description} message={inputError} />;
  }

  const yScale = scaleLinear({ domain: [0, maximumCount], range: [distributionGeometry.height, 0] });
  const selected = bins.find((bin) => bin.id === selection?.selectedId);

  return (
    <ChartFrame
      title={title}
      report={report}
      description={description}
      footer={
        selection !== undefined && bins.length > 0 ? (
          <ChartReadout>
            {selected === undefined
              ? 'Select a bin in View data to inspect its count.'
              : `${selected.label}, ${formatValue(selected.lowerBound)} – ${formatValue(selected.upperBound)}, ${countLabel}: ${selected.count === null ? 'Unavailable' : formatCount(selected.count)}`}
          </ChartReadout>
        ) : undefined
      }
    >
      {bins.length === 0 ? (
        <p {...stylex.props(distributionStyles.empty)}>{emptyLabel}</p>
      ) : (
        <>
          <NumericPlot
            xDomain={domain}
            yDomain={[0, maximumCount]}
            xLabel={valueLabel}
            yLabel={countLabel}
            formatX={formatValue}
            formatY={formatCount}
          >
            {(plotWidth) => {
              const xScale = scaleLinear({ domain: [...domain], range: [0, plotWidth] });

              return bins.map((bin) => {
                const left = xScale(bin.lowerBound);
                const width = xScale(bin.upperBound) - left;
                const gap = Math.min(2, width * 0.2);
                const isSelected = selection?.selectedId === bin.id;

                if (bin.count === null) {
                  return (
                    <Bar
                      key={bin.id}
                      x={left + gap / 2}
                      y={distributionGeometry.height - 6}
                      width={width - gap}
                      height={5}
                      {...stylex.props(distributionStyles.missing)}
                    />
                  );
                }

                const top = yScale(bin.count);

                return (
                  <Bar
                    key={bin.id}
                    x={left + gap / 2}
                    y={top}
                    width={width - gap}
                    height={distributionGeometry.height - top}
                    fill={chartToneColors[tone]}
                    opacity={selection?.selectedId === undefined || isSelected ? 1 : 0.45}
                  />
                );
              });
            }}
          </NumericPlot>
          <ChartDataDisclosure>
            <div {...stylex.props(distributionStyles.values)}>
              {bins.map((bin) => {
                const count = bin.count === null ? 'Unavailable' : formatCount(bin.count);
                const range = `${formatValue(bin.lowerBound)} – ${formatValue(bin.upperBound)}`;

                return (
                  <ChartDatumButton
                    key={bin.id}
                    label={`${bin.label}, ${range}, ${countLabel}: ${count}`}
                    isSelected={selection?.selectedId === bin.id}
                    onSelect={selection === undefined ? undefined : () => selection.onSelect(bin.id)}
                  >
                    <span {...stylex.props(distributionStyles.value)}>
                      <span>
                        {bin.label} · {range}
                      </span>
                      <span {...stylex.props(distributionStyles.summary)}>{count}</span>
                    </span>
                  </ChartDatumButton>
                );
              })}
            </div>
          </ChartDataDisclosure>
        </>
      )}
    </ChartFrame>
  );
}

function histogramInputError({
  bins,
  domain,
  maximumCount,
}: Pick<HistogramProps, 'bins' | 'domain' | 'maximumCount'>): string | undefined {
  const error = distributionInputError({ items: bins, domain, maxEntries: distributionLimits.bins });

  if (error !== undefined) {
    return error;
  }

  if (!Number.isFinite(maximumCount) || maximumCount <= 0) {
    return 'The histogram count domain must have a finite maximum greater than zero.';
  }

  for (const [index, bin] of bins.entries()) {
    if (outsideDomain(bin.lowerBound, domain) || outsideDomain(bin.upperBound, domain)) {
      return `Histogram bin ${bin.id} has a non-finite bound or lies outside the declared domain.`;
    }

    const previous = bins[index - 1];

    if (bin.lowerBound >= bin.upperBound || (previous !== undefined && bin.lowerBound < previous.upperBound)) {
      return `Histogram bin ${bin.id} is reversed, overlaps another bin, or is out of order.`;
    }

    if (bin.count !== null) {
      if (!Number.isFinite(bin.count) || bin.count < 0 || bin.count > maximumCount) {
        return `Histogram bin ${bin.id} has a count outside the declared count domain.`;
      }
    }
  }

  return undefined;
}
