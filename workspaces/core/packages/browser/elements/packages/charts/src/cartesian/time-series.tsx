import * as stylex from '@stylexjs/stylex';
import { dispatch } from '@ui-sdk/core';
import { scaleLinear } from '@visx/scale';
import { AreaClosed } from '@visx/shape';
import { useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TextButton } from '../../../core/src/index.ts';
import { Skeleton, SkeletonText } from '../../../feedback/src/index.ts';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame } from '../chart-frame.tsx';
import type { ChartSeriesReport } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { ChartInspection, ChartInspectionTitle, inspectionReadout } from '../chart-inspection.tsx';
import { ChartRange } from '../chart-range.tsx';
import type { ChartRangeDetails, ChartRangeValue } from '../chart-range.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, ChartSvgPlot, plotLabel } from '../chart.tsx';
import type { ChartPoint } from '../chart.tsx';
import { usePlotWidth } from '../plot-width.ts';
import { bandValues, findCrossings, nearestTimestamp, prepareBands, validateBands } from './time-series-bands.ts';
import type { FoundCrossing, PlotBand, TimeSeriesBand, TimeSeriesCrossing } from './time-series-bands.ts';
import {
  observationDomain,
  prepareTimeSeries,
  timeSeriesLimits,
  timeSeriesSignature,
  validateTimeSeries,
} from './time-series-data.ts';
import type { PlotPoint, TimeSeries, TimeSeriesMarker } from './time-series-data.ts';
import { TimeSeriesLine } from './time-series-line.tsx';
import { instantsTop, placeInstants, TimeInstants, TimeSeriesBands } from './time-series-overlays.tsx';
import type { TimeLabelledInstant } from './time-series-overlays.tsx';

/** A range of time a reader selects on the plot. The application owns it, for example to filter another view. */
export type TimeRangeSelection = {
  readonly value: ChartRangeValue | null;
  readonly onChange: (range: ChartRangeValue | null, details: ChartRangeDetails) => void;
  /** What each end snaps to and what an arrow key moves the range by, in the timestamps' unit. */
  readonly step: number;
};

export type TimeSeriesChartProps = {
  readonly title: string;
  readonly description?: ReactNode;
  readonly series: ReadonlyArray<TimeSeries>;
  readonly timestampUnit: 'seconds' | 'milliseconds';
  readonly formatTimestamp: (timestamp: number) => string;
  readonly formatValue: (value: number) => string;
  readonly formatTick?: ((value: number) => string) | undefined;
  readonly markers?: ReadonlyArray<TimeSeriesMarker> | undefined;
  readonly height?: number | undefined;
  readonly actions?: ReactNode;
  readonly report?: ChartSeriesReport | undefined;
  /** Shaded ranges with optional center lines, drawn beneath the line series and listed in the legend. */
  readonly bands?: ReadonlyArray<TimeSeriesBand> | undefined;
  /** Where a series or band center first reaches a value. A crossing that never happens is listed as not reached. */
  readonly crossings?: ReadonlyArray<TimeSeriesCrossing> | undefined;
  /** Lets a reader select a range of time by dragging on the plot, with the keyboard, or with the buttons below it. */
  readonly rangeSelection?: TimeRangeSelection | undefined;
};

export type AreaChartProps = TimeSeriesChartProps & { readonly isStacked?: boolean | undefined };

export type TimeSeriesChartPlaceholderProps = Pick<
  TimeSeriesChartProps,
  'title' | 'description' | 'height' | 'actions' | 'report'
> & { readonly series: ReadonlyArray<Pick<TimeSeries, 'id' | 'label' | 'tone'>> };

export type SmallMultiplesProps = Omit<
  TimeSeriesChartProps,
  | 'series'
  | 'title'
  | 'description'
  | 'actions'
  | 'formatValue'
  | 'formatTick'
  | 'markers'
  | 'report'
  | 'bands'
  | 'crossings'
  | 'rangeSelection'
> & {
  readonly charts: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly series: ReadonlyArray<TimeSeries>;
    readonly description?: ReactNode;
    readonly formatValue: (value: number) => string;
    readonly formatTick?: ((value: number) => string) | undefined;
    readonly markers?: ReadonlyArray<TimeSeriesMarker> | undefined;
    readonly report?: ChartSeriesReport | undefined;
  }>;
};

export type SmallMultiplesPlaceholderProps = Pick<SmallMultiplesProps, 'height'> & {
  readonly charts: ReadonlyArray<TimeSeriesChartPlaceholderProps & { readonly id: string }>;
};

/** One inspection sibling panels share: each marks the timestamp, and the source panel shows its readout. */
type SharedInspection = {
  readonly id: string | null;
  readonly isSource: boolean;
  readonly onChange: (id: string | null) => void;
  readonly within: (target: Node) => boolean;
};

const REPORT_BORDER_WIDTH_PX = 1;

const styles = stylex.create({
  frame: { minWidth: 0 },
  body: { display: 'grid', gap: spacing.md },
  timeAxis: {
    display: 'flex',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    marginBlockStart: spacing.xs,
    fontFamily: typography.monoFamily,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    color: colors.ink,
    fontVariantNumeric: 'tabular-nums',
  },
  timeAxisInset: (left: number, right: number) => ({ paddingInlineStart: left, paddingInlineEnd: right }),
  timestamp: { flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' },
  lastTimestamp: { textAlign: 'end' },
  muted: { color: colors.muted },
  range: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    color: colors.muted,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    overflowWrap: 'anywhere',
  },
  markerList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.md,
    margin: 0,
    padding: 0,
    listStyle: 'none',
    fontSize: typography.captionSize,
    color: colors.muted,
    overflowWrap: 'anywhere',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: typography.captionSize,
    textAlign: 'start',
    fontVariantNumeric: 'tabular-nums',
  },
  cell: {
    padding: spacing.sm,
    textAlign: 'start',
    borderBottomWidth: 1,
    borderBottomStyle: 'solid',
    borderBottomColor: colors.line,
    fontWeight: typography.regularWeight,
  },
  multiples: { display: 'grid', gap: spacing.xl },
  reports: { gap: 0 },
  joinedPanel: { marginBlockStart: -REPORT_BORDER_WIDTH_PX },
  guide: { stroke: colors.muted, strokeDasharray: '3 3', vectorEffect: 'non-scaling-stroke' },
});

function bandSignature({
  bands,
  crossings,
}: {
  readonly bands: ReadonlyArray<TimeSeriesBand>;
  readonly crossings: ReadonlyArray<TimeSeriesCrossing>;
}): string {
  return JSON.stringify([
    bands.map((band) => [
      band.id,
      band.label,
      band.rangeLabel,
      band.tone,
      band.points.map((point) => [point.timestamp, point.lower, point.center, point.upper]),
    ]),
    crossings.map((crossing) => [crossing.id, crossing.seriesId, crossing.value, crossing.label, crossing.direction]),
  ]);
}

function bandRows({
  bands,
  timestamp,
  formatValue,
}: {
  readonly bands: ReadonlyArray<PlotBand>;
  readonly timestamp: number | undefined;
  readonly formatValue: (value: number) => string;
}) {
  return bands.flatMap((band) => {
    const point = band.points.find((item) => item.timestamp === timestamp);
    const center = point?.center ?? null;
    const isBounded = point?.lower !== null && point?.upper !== null && point !== undefined;

    return [
      {
        id: band.id,
        label: band.label,
        tone: band.tone,
        shape: 'band' as const,
        value: center === null ? 'Unavailable' : formatValue(center),
      },
      {
        id: `${band.id}:range`,
        label: band.rangeLabel,
        tone: band.tone,
        shape: 'band' as const,
        value: isBounded ? `${formatValue(point.lower)} – ${formatValue(point.upper)}` : 'Unavailable',
      },
    ];
  });
}

function crossingText({
  found,
  formatTimestamp,
}: {
  readonly found: FoundCrossing;
  readonly formatTimestamp: (timestamp: number) => string;
}): string {
  if (found.timestamp === undefined) {
    return `${found.crossing.label} · Not reached in this range`;
  }

  return `About ${formatTimestamp(found.timestamp)} · ${found.crossing.label}`;
}

export function LineChart(props: TimeSeriesChartProps): ReactNode {
  return <TimeChart {...props} kind="line" isStacked={false} />;
}

export function AreaChart({ isStacked = false, ...props }: AreaChartProps): ReactNode {
  return <TimeChart {...props} kind="area" isStacked={isStacked} />;
}

export function TimeSeriesChartPlaceholder(props: TimeSeriesChartPlaceholderProps): ReactNode {
  return <TimeChartPlaceholder {...props} />;
}

function TimeChartPlaceholder({
  title,
  description,
  series,
  actions,
  report,
  height = 180,
  showTimeAxis = true,
}: TimeSeriesChartPlaceholderProps & { readonly showTimeAxis?: boolean }): ReactNode {
  const inspectionId = useId();

  const legend = prepareTimeSeries(
    series.map((item) => ({ ...item, points: [] })),
    false,
  );

  if (!Number.isFinite(height) || height < 48) {
    return (
      <ChartInputError
        title={title}
        description={description}
        report={report}
        message="Chart height must be at least 48 pixels."
      />
    );
  }

  return (
    <div aria-hidden inert {...stylex.props(styles.frame)}>
      <ChartFrame title={title} description={description} report={report} series={legend} actions={actions}>
        <div {...stylex.props(styles.body)}>
          <ChartInspection
            id={inspectionId}
            label={undefined}
            legend={legend}
            rows={[]}
            x={0}
            width={0}
            hasSeriesSummary={report?.seriesValues !== undefined}
          />
          <div {...stylex.props(chartStyles.plot)}>
            <Skeleton height={height - 16} />
            {showTimeAxis && (
              <div {...stylex.props(styles.timeAxis)}>
                <SkeletonText width="8ch" />
                <SkeletonText width="8ch" />
              </div>
            )}
          </div>
        </div>
      </ChartFrame>
    </div>
  );
}

export function SmallMultiples({ charts, ...props }: SmallMultiplesProps): ReactNode {
  const root = useRef<HTMLDivElement>(null);

  const [inspection, setInspection] = useState<{
    readonly id: string;
    readonly signature: string;
    readonly chartId: string;
  }>();

  const signature = JSON.stringify(
    charts.map((chart) => [
      chart.id,
      chart.title,
      timeSeriesSignature({
        series: chart.series,
        markers: chart.markers ?? [],
        timestampUnit: props.timestampUnit,
        isStacked: false,
      }),
    ]),
  );

  const timestamps = JSON.stringify(charts[0]?.series[0]?.points.map((point) => point.timestamp) ?? []);

  const aligned = charts.every(
    (chart) => JSON.stringify(chart.series[0]?.points.map((point) => point.timestamp) ?? []) === timestamps,
  );

  if (inspection !== undefined && inspection.signature !== signature) {
    setInspection(undefined);
  }

  if (!aligned || !hasUniqueIds(charts)) {
    return (
      <ChartInputError
        title="Small multiples"
        message="Charts need unique identifiers and aligned observation timestamps."
      />
    );
  }

  if (charts.length > timeSeriesLimits.panels) {
    return <ChartInputError title="Small multiples" message={`Choose at most ${timeSeriesLimits.panels} panels.`} />;
  }

  if (charts.length === 0) {
    return (
      <ChartFrame title="Small multiples">
        <p {...stylex.props(styles.muted)}>No charts</p>
      </ChartFrame>
    );
  }

  const axisWidth = Math.max(
    52,
    ...charts.flatMap((chart) =>
      chart.series.flatMap((series) =>
        series.points.flatMap((point) =>
          point.value === null || !Number.isFinite(point.value)
            ? []
            : [(chart.formatTick ?? chart.formatValue)(point.value).length * 7 + 12],
        ),
      ),
    ),
  );

  const isReportGroup = charts.every((chart) => chart.report !== undefined);

  return (
    <div ref={root} {...stylex.props(styles.multiples, isReportGroup && styles.reports)}>
      {charts.map((chart, index) => (
        <div key={chart.id} {...stylex.props(isReportGroup && index > 0 && styles.joinedPanel)}>
          <TimeChart
            {...props}
            title={chart.title}
            description={chart.description}
            report={chart.report}
            series={chart.series}
            formatValue={chart.formatValue}
            formatTick={chart.formatTick}
            markers={chart.markers}
            kind="line"
            isStacked={false}
            sharedInspection={{
              id: inspection?.signature === signature ? inspection.id : null,
              isSource: inspection?.chartId === chart.id,
              onChange: (id): void => setInspection(id === null ? undefined : { id, signature, chartId: chart.id }),
              within: (target): boolean => root.current?.contains(target) === true,
            }}
            axisWidth={axisWidth}
            showTimeAxis={index === charts.length - 1}
          />
        </div>
      ))}
    </div>
  );
}

export function SmallMultiplesPlaceholder({ charts, height }: SmallMultiplesPlaceholderProps): ReactNode {
  if (!hasUniqueIds(charts) || charts.length > timeSeriesLimits.panels) {
    return (
      <ChartInputError
        title="Small multiples"
        message={`Choose at most ${timeSeriesLimits.panels} panels with unique identifiers.`}
      />
    );
  }

  const isReportGroup = charts.every((chart) => chart.report !== undefined);

  return (
    <div aria-hidden inert {...stylex.props(styles.multiples, isReportGroup && styles.reports)}>
      {charts.map((chart, index) => (
        <div key={chart.id} {...stylex.props(isReportGroup && index > 0 && styles.joinedPanel)}>
          <TimeChartPlaceholder {...chart} height={height} showTimeAxis={index === charts.length - 1} />
        </div>
      ))}
    </div>
  );
}

function TimeChart({
  title,
  description,
  series,
  timestampUnit,
  formatTimestamp,
  formatValue,
  formatTick = formatValue,
  markers = [],
  height = 180,
  actions,
  report,
  kind,
  isStacked,
  sharedInspection,
  axisWidth,
  showTimeAxis = true,
  bands = [],
  crossings = [],
  rangeSelection,
}: TimeSeriesChartProps & {
  readonly kind: 'line' | 'area';
  readonly isStacked: boolean;
  readonly sharedInspection?: SharedInspection;
  readonly axisWidth?: number;
  readonly showTimeAxis?: boolean;
}): ReactNode {
  const bandTimeline = bands[0]?.points.map((point) => point.timestamp) ?? [];
  const timeline = series[0]?.points.map((point) => point.timestamp) ?? bandTimeline;

  const issue =
    !Number.isFinite(height) || height < 48
      ? 'Chart height must be at least 48 pixels.'
      : (validateTimeSeries({ series, isStacked, markers, timeline: bandTimeline }) ??
        validateBands({ bands, crossings, series, timestamps: timeline }) ??
        rangeIssue({ rangeSelection, timeline }));

  const prepared = useMemo(
    () => (issue === undefined ? prepareTimeSeries(series, isStacked) : []),
    [series, isStacked, issue],
  );

  const preparedBands = useMemo(
    () => (issue === undefined ? prepareBands({ series, bands }) : []),
    [series, bands, issue],
  );

  const points: ReadonlyArray<{ readonly timestamp: number }> = prepared[0]?.points ?? preparedBands[0]?.points ?? [];
  const { ref, width } = usePlotWidth();

  const inspectionItems = useMemo(
    () => points.map(({ timestamp }) => ({ id: String(timestamp), label: formatTimestamp(timestamp) })),
    [points, formatTimestamp],
  );

  const signature = `${timeSeriesSignature({ series, markers, timestampUnit, isStacked })}${bandSignature({ bands, crossings })}`;

  const legendSeries = [
    ...prepared.map(({ id, label, tone }) => ({ id, label, tone })),
    ...preparedBands.map(({ id, label, tone }) => ({ id, label, tone, shape: 'band' as const })),
  ];

  const hasSeriesSummary = report?.seriesValues !== undefined;
  const inspectionId = useId();

  if (issue !== undefined) {
    return <ChartInputError title={title} description={description} report={report} message={issue} />;
  }

  if (points.length === 0) {
    return (
      <ChartFrame title={title} description={description} actions={actions} report={report} series={legendSeries}>
        <p {...stylex.props(styles.muted)}>No observations</p>
      </ChartFrame>
    );
  }

  const timestamps = points.map((point) => point.timestamp);
  const foundCrossings = findCrossings({ crossings, series, bands });

  const instants: ReadonlyArray<TimeLabelledInstant> = [
    ...markers.flatMap((marker) => (marker.kind === 'event' ? [marker] : [])),
    ...foundCrossings.flatMap(({ crossing, timestamp }) =>
      timestamp === undefined ? [] : [{ id: crossing.id, timestamp, label: crossing.label, value: crossing.value }],
    ),
  ];

  function reading(timestamp: number | undefined) {
    return {
      label: timestamp === undefined ? undefined : formatTimestamp(timestamp),
      rows: [
        ...prepared.map((item) => {
          const point = item.points.find((value) => value.timestamp === timestamp);

          return {
            id: item.id,
            label: item.label,
            tone: item.tone,
            value: point?.value === null || point === undefined ? 'Unavailable' : formatValue(point.value),
          };
        }),
        ...bandRows({ bands: preparedBands, timestamp, formatValue }),
      ],
      notes: [
        ...markers
          .filter((marker) => marker.kind !== 'event' && marker.timestamp === timestamp)
          .map((marker) => marker.label),
        ...instants
          .filter((instant) => nearestTimestamp(timestamps, instant.timestamp) === timestamp)
          .map((instant) => `${instant.label} · ${formatTimestamp(instant.timestamp)}`),
      ],
    };
  }

  const bottom = height - 28;
  const svgHeight = bottom + 12;
  const first = points[0]?.timestamp ?? 0;
  const last = points.at(-1)?.timestamp ?? first;

  const observed = [
    ...prepared.flatMap((item) =>
      item.points.flatMap((point) => (point.value === null ? [] : [point.value + point.base])),
    ),
    ...bandValues(bands),
    ...crossings.map((crossing) => crossing.value),
  ];

  const minimum = kind === 'area' ? Math.min(0, ...observed) : Math.min(...observed);
  const maximum = kind === 'area' ? Math.max(0, ...observed) : Math.max(...observed);
  const low = observed.length === 0 ? 0 : minimum;
  const high = observed.length === 0 ? 1 : maximum;
  const valueDomain = observationDomain(low, high, kind === 'area');
  const tickScale = scaleLinear({ domain: [...valueDomain], range: [bottom, 0] });
  const left = axisWidth ?? Math.max(44, ...tickScale.ticks(3).map((tick) => formatTick(tick).length * 7 + 12));
  const right = Math.max(left + 1, width - 16);
  const x = scaleLinear({ domain: [...observationDomain(first, last)], range: [left, right] });
  const placedInstants = placeInstants({ instants, x, right });
  const top = instantsTop(placedInstants);
  const y = scaleLinear({ domain: [...valueDomain], range: [bottom, top] });
  const yTicks = y.ticks(3);

  function describeRange(range: ChartRangeValue): string {
    return `${formatTimestamp(range[0])} to ${formatTimestamp(range[1])}`;
  }

  function locate(point: ChartPoint): string | undefined {
    const timestamp = x.invert((point.x / point.width) * width);

    const closest = points.find((candidate, index) => {
      const next = points[index + 1];

      return next === undefined || timestamp <= candidate.timestamp + (next.timestamp - candidate.timestamp) / 2;
    });

    return closest === undefined ? undefined : String(closest.timestamp);
  }

  return (
    <div {...stylex.props(styles.frame)}>
      <Chart
        items={inspectionItems}
        readout={(id) => inspectionReadout(reading(Number(id)))}
        locate={locate}
        revision={signature}
        inspected={sharedInspection?.id}
        onInspectedChange={sharedInspection?.onChange}
        within={sharedInspection?.within}
        render={(figure, { inspected, cursor }) => {
          const active = inspected === null ? undefined : Number(inspected);
          const shown = reading(sharedInspection === undefined || sharedInspection.isSource ? active : undefined);

          const plot = (
            <ChartSvgPlot
              role="img"
              aria-label={plotLabel({ title, marks: 'observations', isSelectable: false })}
              aria-describedby={inspectionId}
              viewBox={`0 0 ${width} ${svgHeight}`}
              height={svgHeight}
              {...stylex.props(chartStyles.svg, chartStyles.inspectable, stylex.defaultMarker())}
            >
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={left}
                    x2={right}
                    y1={y(tick)}
                    y2={y(tick)}
                    {...stylex.props(tick === 0 ? chartStyles.baseline : chartStyles.grid)}
                  />
                  <text
                    x={left - 8}
                    y={y(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    {...stylex.props(chartStyles.label, chartStyles.tick)}
                  >
                    {formatTick(tick)}
                  </text>
                </g>
              ))}
              {crossings.map((crossing) => (
                <line
                  key={crossing.id}
                  x1={left}
                  x2={right}
                  y1={y(crossing.value)}
                  y2={y(crossing.value)}
                  {...stylex.props(chartStyles.baseline)}
                />
              ))}
              <TimeSeriesBands bands={preparedBands} x={x} y={y} />
              {prepared.map((item) => (
                <g key={item.id}>
                  {kind === 'area' && (
                    <AreaClosed<PlotPoint>
                      data={[...item.points]}
                      defined={(point) => point.value !== null}
                      x={(point) => x(point.timestamp)}
                      y0={(point) => y(point.base)}
                      y1={(point) => y((point.value ?? 0) + point.base)}
                      yScale={y}
                      fill={chartToneColors[item.tone]}
                      fillOpacity={isStacked ? 0.65 : 0.12}
                    />
                  )}
                  <TimeSeriesLine series={item} x={x} y={y} inspectedTimestamp={active} />
                </g>
              ))}
              <TimeInstants placed={placedInstants} x={x} y={y} bottom={bottom} />
              {markers
                .filter((marker) => marker.kind !== 'event')
                .map((marker) => (
                  <g key={marker.id}>
                    {marker.kind === 'time' ? (
                      <line
                        x1={x(marker.timestamp)}
                        x2={x(marker.timestamp)}
                        y1={top}
                        y2={bottom}
                        {...stylex.props(styles.guide)}
                      />
                    ) : (
                      <circle
                        cx={x(marker.timestamp)}
                        cy={y(
                          marker.value +
                            (prepared
                              .find((item) => item.id === marker.seriesId)
                              ?.points.find((point) => point.timestamp === marker.timestamp)?.base ?? 0),
                        )}
                        r={4}
                        fill={colors.surface}
                        {...stylex.props(chartStyles.selected)}
                      />
                    )}
                    <title>
                      {marker.kind === 'point' ? `${marker.label}: ${formatValue(marker.value)}` : marker.label}
                    </title>
                  </g>
                ))}
              {active !== undefined && (
                <line x1={x(active)} x2={x(active)} y1={top} y2={bottom} {...stylex.props(styles.guide)} />
              )}
              {cursor !== null && (
                <ChartCursor x={x(Number(cursor))} top={top} bottom={bottom} width={Math.min(16, (right - left) / 2)} />
              )}
            </ChartSvgPlot>
          );

          const plotWithRange =
            rangeSelection === undefined || last === first ? (
              plot
            ) : (
              <ChartRange
                value={rangeSelection.value}
                onValueChange={rangeSelection.onChange}
                min={first}
                max={last}
                step={rangeSelection.step}
                describe={describeRange}
                label={`${title} time range`}
                left={x(first)}
                width={x(last) - x(first)}
                height={bottom}
              >
                {plot}
              </ChartRange>
            );

          return (
            <ChartFrame
              figure={figure}
              title={hasSeriesSummary ? title : <ChartInspectionTitle title={title} detail={shown.label} />}
              description={description}
              report={report}
              series={legendSeries}
              actions={actions}
            >
              <ChartData
                label={`${title} observations`}
                columns={[
                  { id: 'time', label: `Time (${timestampUnit})` },
                  ...prepared.map((item) => ({ id: `series:${item.id}`, label: item.label })),
                  ...preparedBands.flatMap((band) => [
                    { id: `band:${band.id}`, label: band.label },
                    { id: `band-range:${band.id}`, label: `${band.label}: ${band.rangeLabel}` },
                  ]),
                ]}
                rows={points.map((point, index) => ({
                  id: point.timestamp,
                  values: [
                    formatTimestamp(point.timestamp),
                    ...prepared.map((item) =>
                      item.points[index]?.value === null || item.points[index]?.value === undefined
                        ? 'Unavailable'
                        : formatValue(item.points[index].value),
                    ),
                    ...bandRows({ bands: preparedBands, timestamp: point.timestamp, formatValue }).map(
                      (row) => row.value,
                    ),
                  ],
                }))}
              />
              <div {...stylex.props(styles.body)}>
                <ChartInspection
                  id={inspectionId}
                  label={shown.label}
                  legend={legendSeries}
                  rows={shown.rows}
                  x={x(active ?? first)}
                  width={width}
                  notes={shown.notes}
                  hasSeriesSummary={hasSeriesSummary}
                />
                <div ref={ref} {...stylex.props(chartStyles.plot)}>
                  {plotWithRange}
                  {showTimeAxis && (
                    <div
                      aria-hidden
                      {...stylex.props(styles.timeAxis, styles.timeAxisInset(left, Math.max(0, width - right)))}
                    >
                      <span {...stylex.props(styles.timestamp)}>{formatTimestamp(first)}</span>
                      {last !== first && (
                        <span {...stylex.props(styles.timestamp, styles.lastTimestamp)}>{formatTimestamp(last)}</span>
                      )}
                    </div>
                  )}
                </div>
                {rangeSelection !== undefined && last !== first && (
                  <div {...stylex.props(styles.range)}>
                    <span>
                      {rangeSelection.value === null
                        ? 'Drag on the plot with a mouse to select a range of time.'
                        : `Selected range: ${describeRange(rangeSelection.value)}`}
                    </span>
                    {rangeSelection.value === null ? (
                      <TextButton
                        type="button"
                        onClick={(event) => {
                          dispatch(
                            { options: () => rangeSelection },
                            'onChange',
                            middleRange({ first, last, rangeSelection }),
                            { reason: 'trigger-press', event: event.nativeEvent },
                          );
                        }}
                      >
                        Select a range
                      </TextButton>
                    ) : (
                      <TextButton
                        type="button"
                        onClick={(event) => {
                          dispatch({ options: () => rangeSelection }, 'onChange', null, {
                            reason: 'clear-press',
                            event: event.nativeEvent,
                          });
                        }}
                      >
                        Clear range
                      </TextButton>
                    )}
                  </div>
                )}
                {markers.length + foundCrossings.length > 0 && (
                  <ul {...stylex.props(styles.markerList)}>
                    {markers.map((marker) => (
                      <li key={marker.id}>
                        {formatTimestamp(marker.timestamp)} · {marker.label}
                        {marker.kind === 'point' && ` · ${formatValue(marker.value)}`}
                      </li>
                    ))}
                    {foundCrossings.map((found) => (
                      <li key={found.crossing.id}>{crossingText({ found, formatTimestamp })}</li>
                    ))}
                  </ul>
                )}
              </div>
            </ChartFrame>
          );
        }}
      />
    </div>
  );
}

function rangeIssue({
  rangeSelection,
  timeline,
}: {
  readonly rangeSelection: TimeRangeSelection | undefined;
  readonly timeline: ReadonlyArray<number>;
}): string | undefined {
  const first = timeline[0];
  const last = timeline.at(-1);

  if (rangeSelection === undefined || first === undefined || last === undefined) {
    return undefined;
  }

  const { step, value } = rangeSelection;
  const span = last - first;

  // One moment has no range to select, so the chart draws without the brush.
  if (span === 0) {
    return undefined;
  }

  if (!Number.isFinite(step) || step <= 0 || step > span) {
    return 'The range selection step must be finite, positive, and no longer than the observed time.';
  }

  if (value === null) {
    return undefined;
  }

  const isInside = value[0] >= first && value[1] <= last;

  if (!isInside || value[0] >= value[1]) {
    return 'The selected range must have ordered ends inside the observed time.';
  }

  return undefined;
}

/** The middle half of the observed time, snapped to the step: where a range starts when a reader asks for one. */
function middleRange({
  first,
  last,
  rangeSelection,
}: {
  readonly first: number;
  readonly last: number;
  readonly rangeSelection: TimeRangeSelection;
}): ChartRangeValue {
  const quarter = Math.max(1, Math.round((last - first) / 4 / rangeSelection.step)) * rangeSelection.step;
  const start = Math.min(first + quarter, last - rangeSelection.step);

  return [start, Math.min(last, Math.max(start + rangeSelection.step, last - quarter))];
}
