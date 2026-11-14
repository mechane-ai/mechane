import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartDataDisclosure, ChartDatumButton, ChartFrame, ChartReadout } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { distributionInputError, distributionLimits, outsideDomain } from './distribution-input.ts';
import type { NumericDomain } from './distribution-input.ts';
import { distributionGeometry, distributionStyles, NumericPlot } from './distribution-plot.tsx';

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
  const inputError = ecdfInputError({ points, domain });

  if (inputError !== undefined) {
    return <ChartInputError title={title} report={report} description={description} message={inputError} />;
  }

  const yScale = scaleLinear({ domain: [0, 1], range: [distributionGeometry.height, 0] });
  const selected = points.find((point) => point.id === selection?.selectedId);

  return (
    <ChartFrame
      title={title}
      report={report}
      description={description}
      footer={
        selection !== undefined && points.length > 0 ? (
          <ChartReadout>
            {selected === undefined
              ? 'Select a point in View data to inspect its probability.'
              : `${valueLabel}: ${formatValue(selected.value)}, ${probabilityLabel}: ${selected.probability === null ? 'Unavailable' : formatProbability(selected.probability)}`}
          </ChartReadout>
        ) : undefined
      }
    >
      {points.length === 0 ? (
        <p {...stylex.props(distributionStyles.empty)}>{emptyLabel}</p>
      ) : (
        <>
          <NumericPlot
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
                        r={selection?.selectedId === point.id ? 4 : 2}
                        fill={chartToneColors[tone]}
                      />
                    );
                  })}
                </>
              );
            }}
          </NumericPlot>
          <ChartDataDisclosure>
            <div {...stylex.props(distributionStyles.values)}>
              {points.map((point) => {
                const value = formatValue(point.value);
                const probability = point.probability === null ? 'Unavailable' : formatProbability(point.probability);

                return (
                  <ChartDatumButton
                    key={point.id}
                    label={`${valueLabel}: ${value}, ${probabilityLabel}: ${probability}`}
                    isSelected={selection?.selectedId === point.id}
                    onSelect={selection === undefined ? undefined : () => selection.onSelect(point.id)}
                  >
                    <span {...stylex.props(distributionStyles.value)}>
                      <span>{value}</span>
                      <span {...stylex.props(distributionStyles.summary)}>{probability}</span>
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
