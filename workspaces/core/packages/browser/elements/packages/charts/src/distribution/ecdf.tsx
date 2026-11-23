import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import { distributionInputError, distributionLimits, outsideDomain } from './distribution-input.ts';
import type { NumericDomain } from './distribution-input.ts';
import { distributionGeometry, distributionStyles, NumericPlot } from './distribution-plot.tsx';

/** Keeps the cursor's underline inside the plot, which clips at its bottom edge. */
const CURSOR_INSET = 6;
const CURSOR_WIDTH = 12;

export type ECDFPoint = { readonly id: string; readonly value: number; readonly probability: number | null };

export type ECDFProps = {
  readonly title: string;
  readonly report?: ChartReport | undefined;
  readonly description?: string;
  readonly points: ReadonlyArray<ECDFPoint>;
  readonly domain: NumericDomain;
  readonly valueLabel: string;
  readonly probabilityLabel: string;
  readonly formatValue: (value: number) => string;
  readonly formatProbability: (probability: number) => string;
  readonly tone?: ChartTone;
  readonly selection?: ChartSelection;
  readonly emptyLabel?: string;
};

export function ECDF({
  title,
  report,
  description,
  points,
  domain,
  valueLabel,
  probabilityLabel,
  formatValue,
  formatProbability,
  tone = 'series1',
  selection,
  emptyLabel = 'No cumulative distribution points are available.',
}: ECDFProps): ReactNode {
  const items = points.map((point) => ({
    id: point.id,
    label: `${valueLabel}: ${formatValue(point.value)}, ${probabilityLabel}: ${point.probability === null ? 'Unavailable' : formatProbability(point.probability)}`,
  }));

  const readoutId = useId();
  const inputError = ecdfInputError({ points, domain });

  if (inputError !== undefined) {
    return <ChartInputError title={title} report={report} description={description} message={inputError} />;
  }

  const yScale = scaleLinear({ domain: [0, 1], range: [distributionGeometry.height, 0] });

  return (
    <Chart
      items={items}
      arrows="both"
      locate={(point) => {
        const value = domain[0] + (point.x / point.width) * (domain[1] - domain[0]);
        const nearest = { point: points[0] };

        for (const item of points) {
          if (nearest.point === undefined || Math.abs(item.value - value) < Math.abs(nearest.point.value - value)) {
            nearest.point = item;
          }
        }

        return nearest.point?.id;
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
          {points.length === 0 ? (
            <p {...stylex.props(distributionStyles.empty)}>{emptyLabel}</p>
          ) : (
            <>
              <NumericPlot
                label={plotLabel({ title, isSelectable: selection !== undefined })}
                readoutId={readoutId}
                xDomain={domain}
                yDomain={[0, 1]}
                xLabel={valueLabel}
                yLabel={probabilityLabel}
                formatX={formatValue}
                formatY={formatProbability}
              >
                {(plotWidth) => {
                  const xScale = scaleLinear({ domain: [...domain], range: [0, plotWidth] });

                  const path = points
                    .map((point, index) => {
                      if (point.probability === null) {
                        return '';
                      }

                      const x = xScale(point.value);
                      const y = yScale(point.probability);
                      const previous = points[index - 1];

                      if (previous === undefined || previous.probability === null) {
                        return `M ${x} ${y}`;
                      }

                      return `H ${x} V ${y}`;
                    })
                    .join(' ');

                  const rest = points.find((point) => point.id === cursor);

                  return (
                    <>
                      <path
                        d={path}
                        fill="none"
                        stroke={chartToneColors[tone]}
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                      />
                      {points.map((point) => {
                        if (point.probability === null) {
                          return null;
                        }

                        return (
                          <circle
                            key={point.id}
                            cx={xScale(point.value)}
                            cy={yScale(point.probability)}
                            r={selection?.selectedId === point.id || inspected === point.id ? 4 : 2}
                            fill={chartToneColors[tone]}
                          />
                        );
                      })}
                      {rest !== undefined && (
                        <ChartCursor
                          x={xScale(rest.value)}
                          top={0}
                          bottom={distributionGeometry.height - CURSOR_INSET}
                          width={CURSOR_WIDTH}
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

function ecdfInputError({ points, domain }: Pick<ECDFProps, 'points' | 'domain'>): string | undefined {
  const error = distributionInputError({ items: points, domain, maxEntries: distributionLimits.cumulativePoints });

  if (error !== undefined) {
    return error;
  }

  const previous = { value: domain[0], probability: 0 };

  for (const point of points) {
    if (outsideDomain(point.value, domain) || point.value < previous.value) {
      return `Cumulative point ${point.id} is non-finite, outside the domain, or out of order.`;
    }

    if (point.probability !== null) {
      if (!Number.isFinite(point.probability) || point.probability < previous.probability || point.probability > 1) {
        return `Cumulative point ${point.id} must have a probability from zero to one that does not decrease.`;
      }

      previous.probability = point.probability;
    }

    previous.value = point.value;
  }

  return undefined;
}
