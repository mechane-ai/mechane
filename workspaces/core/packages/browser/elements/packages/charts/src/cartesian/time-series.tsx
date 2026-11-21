import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { AreaClosed } from '@visx/shape';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Skeleton, SkeletonText } from '../../../feedback/src/index.ts';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { ChartFrame } from '../chart-frame.tsx';
import type { ChartSeriesReport } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { ChartInspection, ChartInspectionTitle, inspectionReadout } from '../chart-inspection.tsx';
import { ChartSvgSurface } from '../chart-surface.tsx';
import { chartStyles } from '../chart-theme.ts';
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

type Inspection = { readonly signature: string; readonly timestamp: number; readonly source: 'pointer' | 'keyboard' };

type SharedInspection = {
  readonly value: Inspection | undefined;
  readonly isSource: boolean;
  readonly onChange: (value: Inspection | undefined) => void;
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
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    color: colors.muted,
    fontVariantNumeric: 'tabular-nums',
  },
  timeAxisInset: (left: number, right: number) => ({ paddingInlineStart: left, paddingInlineEnd: right }),
  timestamp: { flex: '1 1 0', minWidth: 0, overflowWrap: 'anywhere' },
  lastTimestamp: { textAlign: 'end' },
  muted: { color: colors.muted },
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
            source={undefined}
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
  const [inspection, setInspection] = useState<(Inspection & { readonly chartId: string }) | undefined>();

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

  useEffect(() => {
    function dismiss(event: PointerEvent): void {
      if (event.target instanceof Node && root.current?.contains(event.target) !== true) {
        setInspection(undefined);
      }
    }

    document.addEventListener('pointerdown', dismiss);

    return () => document.removeEventListener('pointerdown', dismiss);
  }, []);

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
              value: inspection?.signature === signature ? inspection : undefined,
              isSource: inspection?.chartId === chart.id,
              onChange: (value): void =>
                setInspection(value === undefined ? undefined : { ...value, signature, chartId: chart.id }),
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
        validateBands({ bands, crossings, series, timestamps: timeline }));

  const prepared = useMemo(
    () => (issue === undefined ? prepareTimeSeries(series, isStacked) : []),
    [series, isStacked, issue],
  );

  const preparedBands = useMemo(
    () => (issue === undefined ? prepareBands({ series, bands }) : []),
    [series, bands, issue],
  );

  const points: ReadonlyArray<{ readonly timestamp: number }> = prepared[0]?.points ?? preparedBands[0]?.points ?? [];
  const { ref, width, element } = usePlotWidth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [keyboardTimestamp, setKeyboardTimestamp] = useState<number>();

  const inspectionItems = useMemo(
    () => points.map(({ timestamp }) => ({ id: String(timestamp), label: formatTimestamp(timestamp) })),
    [points, formatTimestamp],
  );

  const cursor = points.find((point) => point.timestamp === keyboardTimestamp) ?? points[0];
  const [inspection, setInspection] = useState<Inspection | undefined>();
  const signature = `${timeSeriesSignature({ series, markers, timestampUnit, isStacked })}${bandSignature({ bands, crossings })}`;

  const legendSeries = [
    ...prepared.map(({ id, label, tone }) => ({ id, label, tone })),
    ...preparedBands.map(({ id, label, tone }) => ({ id, label, tone, shape: 'band' as const })),
  ];

  const active =
    sharedInspection === undefined
      ? inspection?.signature === signature
        ? inspection
        : undefined
      : sharedInspection.value;

  const inspected = sharedInspection === undefined || sharedInspection.isSource ? active : undefined;
  const hasSeriesSummary = report?.seriesValues !== undefined;

  const inspectionId = useId();

  if (inspection !== undefined && (inspection.signature !== signature || issue !== undefined)) {
    setInspection(undefined);
  }

  const hasSharedInspection = sharedInspection !== undefined;

  useEffect(() => {
    if (hasSharedInspection) {
      return;
    }

    function dismiss(event: PointerEvent): void {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) !== true) {
        setInspection(undefined);
      }
    }

    document.addEventListener('pointerdown', dismiss);

    return () => document.removeEventListener('pointerdown', dismiss);
  }, [hasSharedInspection]);

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

  const instantNotes = instants
    .filter((instant) => nearestTimestamp(timestamps, instant.timestamp) === inspected?.timestamp)
    .map((instant) => `${instant.label} · ${formatTimestamp(instant.timestamp)}`);

  const reading = {
    label: inspected === undefined ? undefined : formatTimestamp(inspected.timestamp),
    rows: [
      ...prepared.map((item) => {
        const point = item.points.find((value) => value.timestamp === inspected?.timestamp);

        return {
          id: item.id,
          label: item.label,
          tone: item.tone,
          value: point?.value === null || point === undefined ? 'Unavailable' : formatValue(point.value),
        };
      }),
      ...bandRows({ bands: preparedBands, timestamp: inspected?.timestamp, formatValue }),
    ],
    notes: [
      ...markers
        .filter((marker) => marker.kind !== 'event' && marker.timestamp === inspected?.timestamp)
        .map((marker) => marker.label),
      ...instantNotes,
    ],
  };

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

  function inspectClient(clientX: number): void {
    const bounds = element?.getBoundingClientRect();

    if (bounds === undefined) {
      return;
    }

    const timestamp = x.invert(clientX - bounds.left);

    const closest = points.find((point, index) => {
      const next = points[index + 1];

      return next === undefined || timestamp <= point.timestamp + (next.timestamp - point.timestamp) / 2;
    });

    if (closest !== undefined) {
      updateInspection({ signature, timestamp: closest.timestamp, source: 'pointer' });
    }
  }

  function updateInspection(value: Inspection | undefined): void {
    if (sharedInspection !== undefined) {
      sharedInspection.onChange(value);

      return;
    }

    setInspection(value);
  }

  return (
    <div ref={rootRef} {...stylex.props(styles.frame)}>
      <ChartFrame
        title={
          hasSeriesSummary ? (
            title
          ) : (
            <ChartInspectionTitle
              title={title}
              detail={inspected === undefined ? undefined : formatTimestamp(inspected.timestamp)}
            />
          )
        }
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
              ...bandRows({ bands: preparedBands, timestamp: point.timestamp, formatValue }).map((row) => row.value),
            ],
          }))}
        />
        <div {...stylex.props(styles.body)}>
          <ChartInspection
            id={inspectionId}
            label={reading.label}
            legend={legendSeries}
            rows={reading.rows}
            x={x(active?.timestamp ?? first)}
            width={width}
            source={inspected?.source}
            notes={reading.notes}
            hasSeriesSummary={hasSeriesSummary}
          />
          <div ref={ref} {...stylex.props(chartStyles.plot)}>
            <ChartSvgSurface
              role="img"
              aria-label={`${title}. Use arrow keys to inspect observations.`}
              aria-describedby={inspectionId}
              tabIndex={0}
              viewBox={`0 0 ${width} ${svgHeight}`}
              height={svgHeight}
              controls={{
                items: inspectionItems,
                cursor: cursor === undefined ? undefined : String(cursor.timestamp),
                inspected: inspected === undefined ? undefined : String(inspected.timestamp),
                readout: inspectionReadout(reading),
                onInspect: (id) => {
                  const timestamp = Number(id);

                  setKeyboardTimestamp(timestamp);
                  updateInspection({ signature, timestamp, source: 'keyboard' });
                },
                onDismiss: () => updateInspection(undefined),
              }}
              onFocus={(event) => {
                if (event.currentTarget.matches(':focus-visible')) {
                  const timestamp = active?.timestamp ?? first;

                  setKeyboardTimestamp(timestamp);
                  updateInspection({ signature, timestamp, source: 'keyboard' });
                }
              }}
              onPointerMove={(event) => {
                if (event.pointerType === 'mouse') {
                  inspectClient(event.clientX);
                }
              }}
              onPointerDown={(event) => inspectClient(event.clientX)}
              onPointerLeave={(event) => {
                if (event.pointerType === 'mouse' && active?.source === 'pointer') {
                  updateInspection(undefined);
                }
              }}
              onBlur={() => updateInspection(undefined)}
              {...stylex.props(chartStyles.svg, chartStyles.inspectable, stylex.defaultMarker())}
            >
              {yTicks.map((tick) => (
                <g key={tick}>
                  <line x1={left} x2={right} y1={y(tick)} y2={y(tick)} {...stylex.props(chartStyles.grid)} />
                  <text
                    x={left - 8}
                    y={y(tick)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    {...stylex.props(chartStyles.label)}
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
                      fillOpacity={isStacked ? 0.65 : 0.15}
                    />
                  )}
                  <TimeSeriesLine series={item} x={x} y={y} inspectedTimestamp={active?.timestamp} />
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
                <line
                  x1={x(active.timestamp)}
                  x2={x(active.timestamp)}
                  y1={top}
                  y2={bottom}
                  {...stylex.props(styles.guide)}
                />
              )}
              {cursor !== undefined && (
                <ChartCursor
                  x={x(cursor.timestamp)}
                  top={top}
                  bottom={bottom}
                  width={Math.min(16, (right - left) / 2)}
                />
              )}
            </ChartSvgSurface>
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
    </div>
  );
}
