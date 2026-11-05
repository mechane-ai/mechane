import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';
import { isFiniteDomain } from '../chart-input.tsx';
import { observationDomain, prepareTimeSeries, validateTimeSeries } from './time-series-data.ts';
import type { TimeSeries } from './time-series-data.ts';
import { TimeSeriesLine } from './time-series-line.tsx';

export type SparklineProps = {
  readonly title: string;
  readonly summary: string;
  readonly unit: string;
  readonly timestampUnit: 'seconds' | 'milliseconds';
  readonly series: TimeSeries;
  readonly valueDomain: readonly [number, number];
};

const styles = stylex.create({
  trend: { display: 'inline-block', width: 128, height: 32, flexShrink: 0, verticalAlign: 'middle' },
  unavailable: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
  },
});

export function Sparkline({ title, summary, unit, timestampUnit, series, valueDomain }: SparklineProps): ReactNode {
  const titleId = useId();
  const descriptionId = useId();
  const issue = validateSparkline({ title, summary, unit, series, valueDomain });
  const observed = series.points.some((point) => point.value !== null);

  if (issue !== undefined || !observed) {
    return (
      <span
        role="img"
        aria-label={`${title}. ${summary} Values in ${unit}; timestamps in ${timestampUnit}. ${issue ?? 'No recorded values. Missing observations remain unavailable.'}`}
        title={issue ?? 'No recorded values'}
        {...stylex.props(styles.trend, styles.unavailable)}
      >
        {issue === undefined ? 'No data' : 'Invalid trend'}
      </span>
    );
  }

  const first = series.points[0]?.timestamp ?? 0;
  const last = series.points.at(-1)?.timestamp ?? first;
  const x = scaleLinear({ domain: [...observationDomain(first, last)], range: [3, 125] });
  const y = scaleLinear({ domain: [...valueDomain], range: [29, 3] });
  const prepared = prepareTimeSeries([series], false)[0];

  return (
    <svg
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      focusable="false"
      viewBox="0 0 128 32"
      width={128}
      height={32}
      {...stylex.props(styles.trend)}
    >
      <title id={titleId}>{title}</title>
      <desc id={descriptionId}>
        {summary} Values in {unit}; timestamps in {timestampUnit}. Displayed value domain: {valueDomain[0]} to{' '}
        {valueDomain[1]} {unit}.
      </desc>
      {prepared !== undefined && <TimeSeriesLine series={prepared} x={x} y={y} pointRadius={2} />}
    </svg>
  );
}

function validateSparkline({
  title,
  summary,
  unit,
  series,
  valueDomain,
}: Omit<SparklineProps, 'timestampUnit'>): string | undefined {
  if (title.trim() === '' || summary.trim() === '' || unit.trim() === '') {
    return 'A trend requires a title, a readable summary, and a value unit.';
  }

  if (!isFiniteDomain(valueDomain)) {
    return 'The displayed value domain must have finite, increasing bounds.';
  }

  const issue = validateTimeSeries({ series: [series], isStacked: false, markers: [] });

  if (issue !== undefined) {
    return issue;
  }

  if (
    series.points.some(
      (point) => point.value !== null && (point.value < valueDomain[0] || point.value > valueDomain[1]),
    )
  ) {
    return 'Every recorded value must be inside the declared value domain.';
  }

  return undefined;
}
