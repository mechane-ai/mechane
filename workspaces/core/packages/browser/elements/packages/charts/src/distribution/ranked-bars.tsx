import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { Bar } from '@visx/shape';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartDatumButton, ChartFrame } from '../chart-frame.tsx';
import type { ChartReport, ChartSelection } from '../chart-frame.tsx';
import { ChartInputError } from '../chart-input.tsx';
import { usePlotWidth } from '../plot-width.ts';
import { distributionInputError, distributionLimits, outsideDomain } from './distribution-input.ts';
import type { NumericDomain } from './distribution-input.ts';
import { distributionStyles, DomainLabels } from './distribution-plot.tsx';

export type RankedBarDatum = {
  readonly id: string;
  readonly label: string;
  readonly rank?: string;
  readonly value: number | null;
  readonly tone?: ChartTone;
};

export type RankedBarsProps = {
  readonly title: string;
  readonly report?: ChartReport | undefined;
  readonly description?: string;
  readonly items: ReadonlyArray<RankedBarDatum>;
  readonly domain: NumericDomain;
  readonly valueLabel: string;
  readonly formatValue: (value: number) => string;
  readonly selection?: ChartSelection;
  readonly emptyLabel?: string;
};

export function RankedBars({
  title,
  report,
  description,
  items,
  domain,
  valueLabel,
  formatValue,
  selection,
  emptyLabel = 'No ranked values are available.',
}: RankedBarsProps): ReactNode {
  const { ref, width } = usePlotWidth();
  const inputError = rankedInputError({ items, domain });

  if (inputError !== undefined) {
    return <ChartInputError title={title} report={report} description={description} message={inputError} />;
  }

  const scale = scaleLinear({ domain: [...domain], range: [0, width] });
  const zero = scale(0);

  return (
    <ChartFrame title={title} report={report} description={description} footer={valueLabel}>
      {items.length === 0 ? (
        <p {...stylex.props(distributionStyles.empty)}>{emptyLabel}</p>
      ) : (
        <div {...stylex.props(distributionStyles.values)}>
          {items.map((item) => {
            const value = item.value === null ? 'Unavailable' : formatValue(item.value);
            const label = item.rank === undefined ? item.label : `${item.rank} · ${item.label}`;
            const color = chartToneColors[item.tone ?? 'series1'];

            return (
              <ChartDatumButton
                key={item.id}
                label={`${label}, ${valueLabel}: ${value}`}
                isSelected={selection?.selectedId === item.id}
                onSelect={selection === undefined ? undefined : () => selection.onSelect(item.id)}
              >
                <span {...stylex.props(distributionStyles.row)}>
                  <span {...stylex.props(distributionStyles.rowLabel)}>
                    <span>{label}</span>
                    <span {...stylex.props(distributionStyles.rowValue)}>{value}</span>
                  </span>
                  <svg
                    aria-hidden
                    viewBox={`0 0 ${width} 28`}
                    preserveAspectRatio="none"
                    {...stylex.props(distributionStyles.rowSvg)}
                  >
                    <line x1={zero} x2={zero} y1={3} y2={25} {...stylex.props(distributionStyles.baseline)} />
                    {item.value !== null &&
                      (item.value === 0 ? (
                        <line
                          x1={zero}
                          x2={zero}
                          y1={10}
                          y2={18}
                          stroke={color}
                          strokeWidth={2}
                          vectorEffect="non-scaling-stroke"
                        />
                      ) : (
                        <Bar
                          x={Math.min(zero, scale(item.value))}
                          y={10}
                          width={Math.abs(scale(item.value) - zero)}
                          height={8}
                          fill={color}
                        />
                      ))}
                  </svg>
                </span>
              </ChartDatumButton>
            );
          })}
          <div {...stylex.props(distributionStyles.row, distributionStyles.rowAxis)}>
            <span {...stylex.props(distributionStyles.axisSpacer)} />
            <div ref={ref}>
              <DomainLabels domain={domain} formatValue={formatValue} />
            </div>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

function rankedInputError({ items, domain }: Pick<RankedBarsProps, 'items' | 'domain'>): string | undefined {
  const error = distributionInputError({ items, domain, maxEntries: distributionLimits.rows });

  if (error !== undefined) {
    return error;
  }

  if (domain[0] > 0 || domain[1] < 0) {
    return 'The ranked-value domain must include zero.';
  }

  for (const item of items) {
    if (item.value !== null && outsideDomain(item.value, domain)) {
      return `Ranked value ${item.id} is non-finite or lies outside the declared domain.`;
    }
  }

  return undefined;
}
