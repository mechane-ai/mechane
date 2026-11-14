import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
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

export type IntervalDatum = {
  readonly id: string;
  readonly label: string;
  readonly lower: number | null;
  readonly estimate: number | null;
  readonly upper: number | null;
  readonly tone?: ChartTone;
};

export type IntervalPlotProps = {
  readonly title: string;
  readonly report?: ChartReport | undefined;
  readonly description?: string;
  readonly items: ReadonlyArray<IntervalDatum>;
  readonly domain: NumericDomain;
  readonly valueLabel: string;
  readonly intervalLabel: string;
  readonly formatValue: (value: number) => string;
  readonly selection?: ChartSelection;
  readonly emptyLabel?: string;
};

export function IntervalPlot({
  title,
  report,
  description,
  items,
  domain,
  valueLabel,
  intervalLabel,
  formatValue,
  selection,
  emptyLabel = 'No interval estimates are available.',
}: IntervalPlotProps): ReactNode {
  const { ref, width } = usePlotWidth();
  const inputError = intervalInputError({ items, domain });

  if (inputError !== undefined) {
    return <ChartInputError title={title} report={report} description={description} message={inputError} />;
  }

  const scale = scaleLinear({ domain: [...domain], range: [0, width] });

  return (
    <ChartFrame title={title} report={report} description={description} footer={`${valueLabel} · ${intervalLabel}`}>
      {items.length === 0 ? (
        <p {...stylex.props(distributionStyles.empty)}>{emptyLabel}</p>
      ) : (
        <div {...stylex.props(distributionStyles.values)}>
          {items.map((item) => {
            const estimate = item.estimate === null ? 'Estimate unavailable' : formatValue(item.estimate);
            const lower = item.lower === null ? 'Unavailable' : formatValue(item.lower);
            const upper = item.upper === null ? 'Unavailable' : formatValue(item.upper);
            const interval = `${intervalLabel}: ${lower} – ${upper}`;
            const color = chartToneColors[item.tone ?? 'series1'];

            return (
              <ChartDatumButton
                key={item.id}
                label={`${item.label}, ${valueLabel}: ${estimate}, ${interval}`}
                isSelected={selection?.selectedId === item.id}
                onSelect={selection === undefined ? undefined : () => selection.onSelect(item.id)}
              >
                <span {...stylex.props(distributionStyles.row)}>
                  <span {...stylex.props(distributionStyles.rowLabel)}>
                    <span>{item.label}</span>
                    <span {...stylex.props(distributionStyles.rowValue)}>{estimate}</span>
                    <span {...stylex.props(distributionStyles.label)}>{interval}</span>
                  </span>
                  <svg
                    aria-hidden
                    viewBox={`0 0 ${width} 28`}
                    preserveAspectRatio="none"
                    {...stylex.props(distributionStyles.rowSvg)}
                  >
                    <line x1={0} x2={width} y1={14} y2={14} {...stylex.props(distributionStyles.baseline)} />
                    {item.lower !== null && item.upper !== null && (
                      <g stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke">
                        <line x1={scale(item.lower)} x2={scale(item.upper)} y1={14} y2={14} />
                        <line x1={scale(item.lower)} x2={scale(item.lower)} y1={9} y2={19} />
                        <line x1={scale(item.upper)} x2={scale(item.upper)} y1={9} y2={19} />
                      </g>
                    )}
                    {item.estimate !== null && <circle cx={scale(item.estimate)} cy={14} r={4} fill={color} />}
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

function intervalInputError({ items, domain }: Pick<IntervalPlotProps, 'items' | 'domain'>): string | undefined {
  const error = distributionInputError({ items, domain, maxEntries: distributionLimits.rows });

  if (error !== undefined) {
    return error;
  }

  for (const item of items) {
    const values = [item.lower, item.estimate, item.upper];

    if (values.some((value) => value !== null && outsideDomain(value, domain))) {
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
