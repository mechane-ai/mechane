import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';
import { isFiniteDomain } from '../chart-input.tsx';
import { observationDomain, prepareTimeSeries, validateTimeSeries } from './time-series-data.ts';
import type { TimeSeries, TimeSeriesPoint } from './time-series-data.ts';
import { TimeSeriesLine } from './time-series-line.tsx';

/** A recorded point a sparkline can mark: the lowest, the highest, or the latest present observation. */
export type SparklinePoint = 'minimum' | 'maximum' | 'last';

export type SparklineProps = {
  readonly title: string;
  readonly summary: string;
  readonly unit: string;
  readonly timestampUnit: 'seconds' | 'milliseconds';
  readonly series: TimeSeries;
  readonly valueDomain: readonly [number, number];
  /**
   * Marks these recorded points: hollow rings at the first lowest and highest values, and a solid dot at the latest.
   * Their values join the accessible description. Absent marks nothing.
   */
  readonly markedPoints?: ReadonlyArray<SparklinePoint> | undefined;
  /** Draws a faint reference value, such as a target, inside `valueDomain`. Absent draws none. */
  readonly baseline?: number | undefined;
};

type RecordedPoint = TimeSeriesPoint & { readonly value: number };

type MarkedObservation = { readonly kind: SparklinePoint; readonly point: RecordedPoint };

const pointNames = { minimum: 'Lowest', maximum: 'Highest', last: 'Latest' } satisfies Record<SparklinePoint, string>;

const styles = stylex.create({
  trend: { display: 'inline-block', width: 128, height: 32, flexShrink: 0, verticalAlign: 'middle' },
  baseline: { stroke: colors.faint, strokeWidth: 1, strokeDasharray: '2 2', vectorEffect: 'non-scaling-stroke' },
  ring: { fill: colors.surface, strokeWidth: 1.25, vectorEffect: 'non-scaling-stroke' },
  unavailable: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.muted,
    fontFamily: typography.fontFamily,
    fontSize: typography.captionSize,
  },
});

const MARK_RADIUS = 2.5;

function markedObservations({
  points,
  marked,
}: {
  readonly points: ReadonlyArray<TimeSeriesPoint>;
  readonly marked: ReadonlyArray<SparklinePoint>;
}): ReadonlyArray<MarkedObservation> {
  const recorded: ReadonlyArray<RecordedPoint> = points.flatMap((point) =>
    point.value === null ? [] : [{ ...point, value: point.value }],
  );

  const values = recorded.map((point) => point.value);
  const lowest = recorded.find((point) => point.value === Math.min(...values));
  const highest = recorded.find((point) => point.value === Math.max(...values));

  const found = { minimum: lowest, maximum: highest, last: recorded.at(-1) } satisfies Record<
    SparklinePoint,
    RecordedPoint | undefined
  >;

  return marked.flatMap((kind) => {
    const point = found[kind];

    return point === undefined ? [] : [{ kind, point }];
  });
}

export function Sparkline({
  title,
  summary,
  unit,
  timestampUnit,
  series,
  valueDomain,
  markedPoints = [],
  baseline,
}: SparklineProps): ReactNode {
  const titleId = useId();
  const descriptionId = useId();
  const issue = validateSparkline({ title, summary, unit, series, valueDomain, markedPoints, baseline });
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
  const color = chartToneColors[prepared?.tone ?? 'series1'];
  const marks = markedObservations({ points: series.points, marked: markedPoints });

  const markText = marks.map(({ kind, point }) => `${pointNames[kind]}: ${point.value} ${unit}.`).join(' ');
  const baselineText = baseline === undefined ? '' : `Reference: ${baseline} ${unit}.`;

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
        {valueDomain[1]} {unit}. {markText} {baselineText}
      </desc>
      {baseline !== undefined && (
        <line x1={3} x2={125} y1={y(baseline)} y2={y(baseline)} {...stylex.props(styles.baseline)} />
      )}
      {prepared !== undefined && <TimeSeriesLine series={prepared} x={x} y={y} pointRadius={2} />}
      {marks.map(({ kind, point }) =>
        kind === 'last' ? (
          <circle key={kind} cx={x(point.timestamp)} cy={y(point.value)} r={MARK_RADIUS} fill={color} />
        ) : (
          <circle
            key={kind}
            cx={x(point.timestamp)}
            cy={y(point.value)}
            r={MARK_RADIUS}
            stroke={color}
            {...stylex.props(styles.ring)}
          />
        ),
      )}
    </svg>
  );
}

function validateSparkline({
  title,
  summary,
  unit,
  series,
  valueDomain,
  markedPoints,
  baseline,
}: Omit<SparklineProps, 'timestampUnit' | 'markedPoints'> & { readonly markedPoints: ReadonlyArray<SparklinePoint> }):
  | string
  | undefined {
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

  if (new Set(markedPoints).size !== markedPoints.length) {
    return 'Mark each recorded point at most once.';
  }

  const isBaselineInside = baseline === undefined || (baseline >= valueDomain[0] && baseline <= valueDomain[1]);

  if (!isBaselineInside) {
    return 'The reference value must be inside the declared value domain.';
  }

  return undefined;
}
