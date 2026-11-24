import * as stylex from '@stylexjs/stylex';
import { useId } from 'react';
import type { ReactNode } from 'react';
import { accessibility } from '../../../foundations/src/accessibility.ts';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartFrame } from '../chart-frame.tsx';
import { useIsCaptioned } from '../figure/caption-scope.tsx';
import { useTones } from '../figure/tone-scope.tsx';
import { usePlotWidth } from '../plot-width.ts';
import { continuousScale, isFiniteDomain } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
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
  readonly valueDomain: NumericDomain;
  /**
   * Marks these recorded points: hollow rings at the first lowest and highest values, and a solid dot at the latest.
   * Their values join the accessible description. Absent marks nothing.
   */
  readonly markedPoints?: ReadonlyArray<SparklinePoint> | undefined;
  /** Draws a faint reference value, such as a target, inside `valueDomain`. Absent draws none. */
  readonly baseline?: number | undefined;
  /**
   * `inline` (the default) draws a 128 by 32 pixel mark to sit beside a number or in a table cell. The `figure` value
   * sets it in the figure frame, with its title and summary shown, filling the width its container gives it.
   */
  readonly layout?: SparklineLayout | undefined;
};

/** Where a sparkline sits: inline beside text, or as a small figure of its own. */
export type SparklineLayout = 'inline' | 'figure';

type RecordedPoint = TimeSeriesPoint & { readonly value: number };

type MarkedObservation = { readonly kind: SparklinePoint; readonly point: RecordedPoint };

const pointNames = { minimum: 'Lowest', maximum: 'Highest', last: 'Latest' } satisfies Record<SparklinePoint, string>;

const styles = stylex.create({
  trend: { display: 'inline-block', width: 128, height: 32, flexShrink: 0, verticalAlign: 'middle' },
  fill: { display: 'block', minWidth: 0 },
  filled: { display: 'block', width: '100%', height: 'auto' },
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
const INSET = 3;
const sizes = { inline: { width: 128, height: 32 }, figure: { height: 48 } } as const;

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

/**
 * A passive trend of one measure: a line on a supplied value domain, with optional marked points and a reference value.
 * The application supplies the summary sentence that states what the line shows.
 */
export function Sparkline({
  title,
  summary,
  unit,
  timestampUnit,
  series,
  valueDomain,
  markedPoints = [],
  baseline,
  layout = 'inline',
}: SparklineProps): ReactNode {
  const titleId = useId();
  const measured = usePlotWidth();
  const isFigure = layout === 'figure';
  const width = isFigure ? measured.width : sizes.inline.width;
  const height = isFigure ? sizes.figure.height : sizes.inline.height;
  const descriptionId = useId();
  const tones = useTones();
  const isCaptioned = useIsCaptioned();
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
  const x = continuousScale({ domain: observationDomain(first, last), range: [INSET, width - INSET] }).position;
  const y = continuousScale({ domain: valueDomain, range: [height - INSET, INSET] }).position;
  const prepared = prepareTimeSeries({ series: [series], isStacked: false, tones })[0];
  const color = chartToneColors[prepared?.tone ?? 'series1'];
  const marks = markedObservations({ points: series.points, marked: markedPoints });

  const markText = marks.map(({ kind, point }) => `${pointNames[kind]}: ${point.value} ${unit}.`).join(' ');
  const baselineText = baseline === undefined ? '' : `Reference: ${baseline} ${unit}.`;

  const mark = (
    <svg
      role="img"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      focusable="false"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      {...stylex.props(isFigure ? styles.filled : styles.trend)}
    >
      <title id={titleId}>{title}</title>
      <desc id={descriptionId}>
        {summary} Values in {unit}; timestamps in {timestampUnit}. Displayed value domain: {valueDomain[0]} to{' '}
        {valueDomain[1]} {unit}. {markText} {baselineText}
      </desc>
      {baseline !== undefined && (
        <line x1={INSET} x2={width - INSET} y1={y(baseline)} y2={y(baseline)} {...stylex.props(styles.baseline)} />
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

  if (!isFigure) {
    return mark;
  }

  return (
    <ChartFrame
      title={isCaptioned ? <span {...stylex.props(accessibility.hidden)}>{title}</span> : title}
      description={isCaptioned ? undefined : summary}
    >
      <div ref={measured.ref} {...stylex.props(styles.fill)}>
        {mark}
      </div>
    </ChartFrame>
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
