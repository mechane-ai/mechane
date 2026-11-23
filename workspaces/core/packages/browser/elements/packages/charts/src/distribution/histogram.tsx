import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors, chartToneOutlines } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import { distributionInputError, distributionLimits, outsideDomain } from './distribution-input.ts';
import type { NumericDomain } from './distribution-input.ts';
import { distributionGeometry, distributionStyles, NumericPlot } from './distribution-plot.tsx';

/** Keeps the cursor's underline inside the plot, which clips at its bottom edge. */
const CURSOR_INSET = 6;

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
  const items = bins.map((bin) => ({
    id: bin.id,
    label: `${bin.label}, ${formatValue(bin.lowerBound)} – ${formatValue(bin.upperBound)}, ${countLabel}: ${bin.count === null ? 'Unavailable' : formatCount(bin.count)}`,
  }));

  const readoutId = useId();
  const inputError = histogramInputError({ bins, domain, maximumCount });

  if (inputError !== undefined) {
    return <ChartInputError title={title} report={report} description={description} message={inputError} />;
  }

  const yScale = scaleLinear({ domain: [0, maximumCount], range: [distributionGeometry.height, 0] });

  return (
    <Chart
      items={items}
      arrows="both"
      locate={(point) => {
        const value = domain[0] + (point.x / point.width) * (domain[1] - domain[0]);

        return bins.find((bin) => value >= bin.lowerBound && value <= bin.upperBound)?.id;
      }}
      selected={selection?.selectedId ?? null}
      onSelect={selection?.onSelect}
      render={(figure, { inspected, cursor }) => (
        <ChartFrame
          figure={figure}
          title={title}
          report={report}
          description={description}
          footer={<ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>}
        >
          {bins.length === 0 ? (
            <p {...stylex.props(distributionStyles.empty)}>{emptyLabel}</p>
          ) : (
            <>
              <NumericPlot
                label={plotLabel({ title, isSelectable: selection !== undefined })}
                readoutId={readoutId}
                xDomain={domain}
                yDomain={[0, maximumCount]}
                xLabel={valueLabel}
                yLabel={countLabel}
                formatX={formatValue}
                formatY={formatCount}
              >
                {(plotWidth) => {
                  const xScale = scaleLinear({ domain: [...domain], range: [0, plotWidth] });

                  const marks = bins.map((bin) => {
                    const left = xScale(bin.lowerBound);
                    const width = xScale(bin.upperBound) - left;
                    const gap = Math.min(2, width * 0.2);

                    const isSelected = selection?.selectedId === bin.id || inspected === bin.id;

                    if (bin.count === null) {
                      return (
                        <rect
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
                      <rect
                        key={bin.id}
                        x={left + gap / 2}
                        y={top}
                        width={width - gap}
                        height={distributionGeometry.height - top}
                        fill={chartToneColors[tone]}
                        stroke={chartToneOutlines[tone]}
                        {...stylex.props(chartStyles.outlined, isSelected && chartStyles.selected)}
                        opacity={selection?.selectedId === undefined || isSelected ? 1 : 0.45}
                      />
                    );
                  });

                  const rest = bins.find((bin) => bin.id === cursor);

                  return (
                    <>
                      {marks}
                      {rest !== undefined && (
                        <ChartCursor
                          x={(xScale(rest.lowerBound) + xScale(rest.upperBound)) / 2}
                          top={0}
                          bottom={distributionGeometry.height - CURSOR_INSET}
                          width={xScale(rest.upperBound) - xScale(rest.lowerBound)}
                        />
                      )}
                    </>
                  );
                }}
              </NumericPlot>
              <ChartData
                label={`${title} observations`}
                columns={[{ id: 'observation', label: 'Observation' }]}
                rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
              />
            </>
          )}
        </ChartFrame>
      )}
    />
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
