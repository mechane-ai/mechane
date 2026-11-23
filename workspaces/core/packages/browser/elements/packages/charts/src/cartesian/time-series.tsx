import * as stylex from '@stylexjs/stylex';
import { dispatch } from '@ui-sdk/core';
import { useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { TextButton } from '../../../core/src/index.ts';
import { Skeleton, SkeletonText } from '../../../feedback/src/index.ts';
import { colors, spacing, typography } from '../../../foundations/src/tokens.stylex.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { ChartInspection, inspectionReadout } from '../chart-inspection.tsx';
import { ChartRange } from '../chart-range.tsx';
import type { ChartRangeDetails, ChartRangeValue } from '../chart-range.tsx';
import type { ChartMarkShape } from '../chart-series-marker.tsx';
import { Chart, plotLabel } from '../chart.tsx';
import { formatTime, formatValue } from '../figure/figure-format.ts';
import type { TimeFormat, ValueFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid } from '../figure/figure-frame.tsx';
import type { FigureFrameInput, SeriesFigureProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { locateNearest } from '../plot/locate.ts';
import { areaPath, isolatedPoints, linePath } from '../plot/path.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { fitDomain, plotHeights, timePlot, valueGutter } from '../plot/plot-layout.ts';
import type { PlotAxis, PlotHeight } from '../plot/plot-layout.ts';
import { AreaMark, DotMark, GuideMark, LineMark, RingMark, RuleMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import type { NumericDomain } from '../plot/scale.ts';
import { bandValues, findCrossings, nearestTimestamp, prepareBands, validateBands } from './time-series-bands.ts';
import type { FoundCrossing, PlotBand, TimeSeriesBand, TimeSeriesCrossing } from './time-series-bands.ts';
import {
  observationDomain,
  prepareTimeSeries,
  timeSeriesLimits,
  timeSeriesSignature,
  validateTimeSeries,
} from './time-series-data.ts';
import type { TimeSeries, TimeSeriesMarker } from './time-series-data.ts';
import { instantsInset, placeInstants, TimeInstants, TimeSeriesBands } from './time-series-overlays.tsx';
import type { TimeLabelledInstant } from './time-series-overlays.tsx';

/** The unit of the supplied timestamps. Formats always receive milliseconds. */
export type TimestampUnit = 'seconds' | 'milliseconds';

/**
 * A line chart of measures over time. The series share their observation timestamps; a null value is a gap. Formats
 * write the values and instants in the figure's locale.
 */
export type TimeSeriesChartProps = SeriesFigureProps & {
  readonly series: ReadonlyArray<TimeSeries>;
  readonly timestampUnit: TimestampUnit;
  /** How readouts, tables and the time axis write an instant. */
  readonly timeFormat: TimeFormat;
  /** How readouts and tables write a value. */
  readonly valueFormat: ValueFormat;
  /** How the value axis writes its ticks. Absent uses the compact form of `valueFormat`. */
  readonly tickFormat?: ValueFormat | undefined;
  /**
   * The value axis title, with its unit: "Latency (ms)". With a title the ticks leave a `unit` style out, so the unit
   * is written once. Absent draws no title and keeps the unit in every tick.
   */
  readonly valueLabel?: string | undefined;
  readonly markers?: ReadonlyArray<TimeSeriesMarker> | undefined;
  readonly height?: PlotHeight | undefined;
  /** Shaded ranges with optional center lines, drawn beneath the line series and listed in the legend. */
  readonly bands?: ReadonlyArray<TimeSeriesBand> | undefined;
  /** Where a series or band center first reaches a value. A crossing that never happens is listed as not reached. */
  readonly crossings?: ReadonlyArray<TimeSeriesCrossing> | undefined;
  /** The selected time range, in the timestamps' unit. The application owns it, for example to filter another view. */
  readonly range?: ChartRangeValue | null | undefined;
  /**
   * Lets a reader select a range of time by dragging on the plot, with the keyboard, or with the buttons below it.
   * Requires `rangeStep`.
   */
  readonly onRangeChange?: ((range: ChartRangeValue | null, details: ChartRangeDetails) => void) | undefined;
  /** What each end of the range snaps to and what an arrow key moves it by, in the timestamps' unit. */
  readonly rangeStep?: number | undefined;
};

/** A filled area chart over time. Stacked areas add up supplied nonnegative values from zero. */
export type AreaChartProps = TimeSeriesChartProps & { readonly isStacked?: boolean | undefined };

/** The frame of a time-series chart before its first read, with the series it will draw. */
export type TimeSeriesChartPlaceholderProps = Omit<FigureFrameInput, 'status'> & {
  readonly series: ReadonlyArray<Pick<TimeSeries, 'id' | 'label' | 'tone'>>;
  readonly height?: PlotHeight | undefined;
};

/**
 * One panel of small multiples: its own frame, series, value format, axis title, markers and pale uncertainty bands
 * (the same `TimeSeriesBand` shape a line chart takes).
 */
export type SmallMultiplesPanel = Omit<SeriesFigureProps, 'locale' | 'status'> &
  Pick<TimeSeriesChartProps, 'series' | 'valueFormat' | 'tickFormat' | 'valueLabel' | 'markers' | 'bands'> & {
    readonly id: string;
  };

/** Panels that share observation timestamps, the time axis and one inspected timestamp. */
export type SmallMultiplesProps = Pick<
  TimeSeriesChartProps,
  'timestampUnit' | 'timeFormat' | 'height' | 'locale' | 'status'
> & { readonly charts: ReadonlyArray<SmallMultiplesPanel> };

/** The panels of small multiples before their first read, at the same height. */
export type SmallMultiplesPlaceholderProps = Pick<SmallMultiplesProps, 'height' | 'locale'> & {
  readonly charts: ReadonlyArray<Omit<TimeSeriesChartPlaceholderProps, 'locale' | 'height'> & { readonly id: string }>;
};

/** One inspection sibling panels share: each marks the timestamp, and the source panel shows its readout. */
type SharedInspection = {
  readonly id: string | null;
  readonly isSource: boolean;
  readonly onChange: (id: string | null) => void;
  readonly within: (target: Node) => boolean;
};

const REPORT_BORDER_WIDTH_PX = 1;
const millisecondsPer = { seconds: 1000, milliseconds: 1 } as const satisfies Record<TimestampUnit, number>;
const TIME_AXIS_PX = 24;
const CURSOR_WIDTH_PX = 12;
const ISOLATED_RADIUS_PX = 2.5;
const QUARTERS = 4;

/** The legend glyph of a series: a line for a line chart, a swatch for a filled area. */
const seriesShapes = { line: 'line', area: 'swatch' } as const satisfies Record<'line' | 'area', ChartMarkShape>;

const styles = stylex.create({
  frame: { minWidth: 0 },
  body: { display: 'grid', gap: spacing.md },
  placeholderPlot: { minWidth: 0 },
  placeholderAxis: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: spacing.md,
    height: TIME_AXIS_PX,
  },
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
  multiples: { display: 'grid', gap: spacing.xl },
  reports: { gap: 0 },
  joinedPanel: { marginBlockStart: -REPORT_BORDER_WIDTH_PX },
});

function toMilliseconds(timestamp: number, unit: TimestampUnit): number {
  return timestamp * millisecondsPer[unit];
}

/** The value axis of a chart or panel. Without a label it draws no title: the frame's title and legend name it. */
function valueAxis({
  format,
  tickFormat,
  label = '',
}: {
  readonly format: ValueFormat;
  readonly tickFormat: ValueFormat | undefined;
  readonly label: string | undefined;
}): PlotAxis {
  return { label, format, tickFormat };
}

/** The value domain fitted to every drawn value. Stacked areas fit their totals; areas always include zero. */
function seriesValueDomain({
  series,
  isStacked,
  isZeroBased,
  bands,
  crossings,
}: {
  readonly series: ReadonlyArray<TimeSeries>;
  readonly isStacked: boolean;
  readonly isZeroBased: boolean;
  readonly bands: ReadonlyArray<TimeSeriesBand>;
  readonly crossings: ReadonlyArray<TimeSeriesCrossing>;
}): NumericDomain {
  const totals = (series[0]?.points ?? []).map((_, index) =>
    series.reduce((total, item) => total + (item.points[index]?.value ?? 0), 0),
  );

  const lines = isStacked ? totals : series.flatMap((item) => item.points.map((point) => point.value));

  return fitDomain({
    values: [...lines, ...bandValues(bands), ...crossings.map((crossing) => crossing.value)],
    isZeroBased,
  });
}

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
  valueText,
}: {
  readonly bands: ReadonlyArray<PlotBand>;
  readonly timestamp: number | undefined;
  readonly valueText: (value: number | null) => string;
}) {
  return bands.flatMap((band) => {
    const point = band.points.find((item) => item.timestamp === timestamp);
    const center = point?.center ?? null;
    const isBounded = point?.lower !== null && point?.upper !== null && point !== undefined;

    return [
      { id: band.id, label: band.label, tone: band.tone, shape: 'band' as const, value: valueText(center) },
      {
        id: `${band.id}:range`,
        label: band.rangeLabel,
        tone: band.tone,
        shape: 'band' as const,
        value: isBounded ? `${valueText(point.lower)} – ${valueText(point.upper)}` : valueText(null),
      },
    ];
  });
}

function crossingText({
  found,
  timeText,
}: {
  readonly found: FoundCrossing;
  readonly timeText: (timestamp: number) => string;
}): string {
  if (found.timestamp === undefined) {
    return `${found.crossing.label} · Not reached in this range`;
  }

  return `About ${timeText(found.timestamp)} · ${found.crossing.label}`;
}

/** Measures over elapsed time, with gaps, markers, bands, crossings and an optional selected range. */
export function LineChart(props: TimeSeriesChartProps): ReactNode {
  return <TimeChart {...props} kind="line" isStacked={false} />;
}

/** Magnitudes over elapsed time, filled from zero, or stacked when the supplied values add up. */
export function AreaChart({ isStacked = false, ...props }: AreaChartProps): ReactNode {
  return <TimeChart {...props} kind="area" isStacked={isStacked} />;
}

/** Holds a time-series chart's frame, legend and height while its first read is under way. */
export function TimeSeriesChartPlaceholder(props: TimeSeriesChartPlaceholderProps): ReactNode {
  return <TimeChartPlaceholder {...props} />;
}

function TimeChartPlaceholder({
  series,
  height = 'compact',
  showTimeAxis = true,
  ...frame
}: TimeSeriesChartPlaceholderProps & { readonly showTimeAxis?: boolean }): ReactNode {
  const inspectionId = useId();
  const tones = useTones();

  const legend = prepareTimeSeries({
    series: series.map((item) => ({ ...item, points: [] })),
    isStacked: false,
    tones,
  });

  return (
    <div aria-hidden inert {...stylex.props(styles.frame)}>
      <FigureFrame
        {...frame}
        status="loading"
        series={legend}
        seriesLegend={
          <ChartInspection
            id={inspectionId}
            label={undefined}
            legend={legend}
            rows={[]}
            x={0}
            width={0}
            hasSeriesSummary={frame.report?.seriesValues !== undefined}
          />
        }
      >
        <div {...stylex.props(styles.body)}>
          <div {...stylex.props(styles.placeholderPlot)}>
            <Skeleton height={plotHeights[height] - TIME_AXIS_PX} />
            <div {...stylex.props(styles.placeholderAxis)}>
              {showTimeAxis && (
                <>
                  <SkeletonText width="8ch" />
                  <SkeletonText width="8ch" />
                </>
              )}
            </div>
          </div>
        </div>
      </FigureFrame>
    </div>
  );
}

/**
 * Measures compared on the same observation timestamps, one panel each, with independent value scales and units. The
 * panels share one value gutter and the time axis under the last panel. One inspected timestamp guides every panel; the
 * panel the reader inspects shows the readout.
 */
export function SmallMultiples({
  charts,
  timestampUnit,
  timeFormat,
  height = 'compact',
  locale,
  status,
}: SmallMultiplesProps): ReactNode {
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
      timeSeriesSignature({ series: chart.series, markers: chart.markers ?? [], timestampUnit, isStacked: false }),
    ]),
  );

  const timestamps = JSON.stringify(charts[0]?.series[0]?.points.map((point) => point.timestamp) ?? []);

  const aligned = charts.every(
    (chart) => JSON.stringify(chart.series[0]?.points.map((point) => point.timestamp) ?? []) === timestamps,
  );

  if (inspection !== undefined && inspection.signature !== signature) {
    setInspection(undefined);
  }

  if (status === 'loading') {
    return <SmallMultiplesPlaceholder charts={charts} height={height} locale={locale} />;
  }

  if (!aligned || !hasUniqueIds(charts)) {
    return (
      <FigureInvalid
        title="Small multiples"
        locale={locale}
        message="Charts need unique identifiers and aligned observation timestamps."
      />
    );
  }

  if (charts.length > timeSeriesLimits.panels) {
    return (
      <FigureInvalid
        title="Small multiples"
        locale={locale}
        message={`Choose at most ${timeSeriesLimits.panels} panels.`}
      />
    );
  }

  if (charts.length === 0) {
    return (
      <FigureFrame title="Small multiples" locale={locale}>
        <FigureEmpty>No charts</FigureEmpty>
      </FigureFrame>
    );
  }

  const gutter = valueGutter({
    height: plotHeights[height],
    locale,
    hasValueTitle: charts.some((chart) => chart.valueLabel !== undefined),
    axes: charts.map((chart) => ({
      axis: valueAxis({ format: chart.valueFormat, tickFormat: chart.tickFormat, label: chart.valueLabel }),
      domain: seriesValueDomain({
        series: chart.series,
        isStacked: false,
        isZeroBased: false,
        bands: chart.bands ?? [],
        crossings: [],
      }),
    })),
  });

  const isReportGroup = charts.every((chart) => chart.report !== undefined);

  return (
    <div ref={root} {...stylex.props(styles.multiples, isReportGroup && styles.reports)}>
      {charts.map(({ id: chartId, ...chart }, index) => (
        <div key={chartId} {...stylex.props(isReportGroup && index > 0 && styles.joinedPanel)}>
          <TimeChart
            {...chart}
            locale={locale}
            status={status}
            timestampUnit={timestampUnit}
            timeFormat={timeFormat}
            height={height}
            kind="line"
            isStacked={false}
            sharedInspection={{
              id: inspection?.signature === signature ? inspection.id : null,
              isSource: inspection?.chartId === chartId,
              onChange: (id): void => setInspection(id === null ? undefined : { id, signature, chartId }),
              within: (target): boolean => root.current?.contains(target) === true,
            }}
            gutter={gutter}
            showTimeAxis={index === charts.length - 1}
          />
        </div>
      ))}
    </div>
  );
}

/** Holds the panels of small multiples, their summaries and the bottom time axis while the first read is under way. */
export function SmallMultiplesPlaceholder({ charts, height, locale }: SmallMultiplesPlaceholderProps): ReactNode {
  if (!hasUniqueIds(charts) || charts.length > timeSeriesLimits.panels) {
    return (
      <FigureInvalid
        title="Small multiples"
        locale={locale}
        message={`Choose at most ${timeSeriesLimits.panels} panels with unique identifiers.`}
      />
    );
  }

  const isReportGroup = charts.every((chart) => chart.report !== undefined);

  return (
    <div aria-hidden inert {...stylex.props(styles.multiples, isReportGroup && styles.reports)}>
      {charts.map(({ id, ...chart }, index) => (
        <div key={id} {...stylex.props(isReportGroup && index > 0 && styles.joinedPanel)}>
          <TimeChartPlaceholder {...chart} locale={locale} height={height} showTimeAxis={index === charts.length - 1} />
        </div>
      ))}
    </div>
  );
}

function TimeChart({
  series,
  timestampUnit,
  timeFormat,
  valueFormat,
  tickFormat,
  valueLabel,
  markers = [],
  height = 'compact',
  kind,
  isStacked,
  sharedInspection,
  gutter,
  showTimeAxis = true,
  bands = [],
  crossings = [],
  range = null,
  onRangeChange,
  rangeStep,
  emptyLabel = 'No observations',
  ...frame
}: TimeSeriesChartProps & {
  readonly kind: 'line' | 'area';
  readonly isStacked: boolean;
  readonly sharedInspection?: SharedInspection;
  /** The value gutter sibling panels share. */
  readonly gutter?: number;
  readonly showTimeAxis?: boolean;
}): ReactNode {
  const { title, locale, report } = frame;
  const tones = useTones();
  const size = usePlotSize(height);
  const inspectionId = useId();
  const bandTimeline = bands[0]?.points.map((point) => point.timestamp) ?? [];
  const timeline = series[0]?.points.map((point) => point.timestamp) ?? bandTimeline;

  const issue =
    validateTimeSeries({ series, isStacked, markers, timeline: bandTimeline }) ??
    validateBands({ bands, crossings, series, timestamps: timeline }) ??
    rangeIssue({ range, rangeStep, isSelectable: onRangeChange !== undefined, timeline });

  const prepared = issue === undefined ? prepareTimeSeries({ series, isStacked, tones }) : [];
  const preparedBands = issue === undefined ? prepareBands({ series, bands, tones }) : [];
  const points: ReadonlyArray<{ readonly timestamp: number }> = prepared[0]?.points ?? preparedBands[0]?.points ?? [];

  function timeText(timestamp: number): string {
    return formatTime({ timestamp: toMilliseconds(timestamp, timestampUnit), locale, format: timeFormat });
  }

  function valueText(value: number | null): string {
    return formatValue({ value, locale, format: valueFormat });
  }

  const inspectionItems = points.map(({ timestamp }) => ({ id: String(timestamp), label: timeText(timestamp) }));
  const signature = `${timeSeriesSignature({ series, markers, timestampUnit, isStacked })}${bandSignature({ bands, crossings })}`;

  const legendSeries = [
    ...prepared.map(({ id, label, tone }) => ({ id, label, tone, shape: seriesShapes[kind] })),
    ...preparedBands.map(({ id, label, tone }) => ({ id, label, tone, shape: 'band' as const })),
  ];

  const hasSeriesSummary = report?.seriesValues !== undefined;

  if (frame.status === 'loading') {
    return <TimeChartPlaceholder {...frame} series={series} height={height} showTimeAxis={showTimeAxis} />;
  }

  if (issue !== undefined) {
    return <FigureInvalid {...frame} message={issue} />;
  }

  if (points.length === 0) {
    return (
      <FigureFrame {...frame} series={legendSeries}>
        <FigureEmpty>{emptyLabel}</FigureEmpty>
      </FigureFrame>
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
      label: timestamp === undefined ? undefined : timeText(timestamp),
      rows: [
        ...prepared.map((item) => {
          const point = item.points.find((value) => value.timestamp === timestamp);

          return { id: item.id, label: item.label, tone: item.tone, value: valueText(point?.value ?? null) };
        }),
        ...bandRows({ bands: preparedBands, timestamp, valueText }),
      ],
      notes: [
        ...markers
          .filter((marker) => marker.kind !== 'event' && marker.timestamp === timestamp)
          .map((marker) => marker.label),
        ...instants
          .filter((instant) => nearestTimestamp(timestamps, instant.timestamp) === timestamp)
          .map((instant) => `${instant.label} · ${timeText(instant.timestamp)}`),
      ],
    };
  }

  const first = timestamps[0] ?? 0;
  const last = timestamps.at(-1) ?? first;

  const layout = {
    width: size.width,
    height: size.height,
    value: valueAxis({ format: valueFormat, tickFormat, label: valueLabel }),
    valueDomain: seriesValueDomain({ series, isStacked, isZeroBased: kind === 'area', bands, crossings }),
    timeDomain: observationDomain(toMilliseconds(first, timestampUnit), toMilliseconds(last, timestampUnit)),
    timeFormat,
    locale,
    gutter,
    hasValueTitle: valueLabel !== undefined,
  };

  // The label lanes above the plot depend only on horizontal positions, which the extra top room leaves unchanged.
  const unlabelled = timePlot(layout);

  const placedInstants = placeInstants({
    instants,
    x: (timestamp) => unlabelled.x.position(toMilliseconds(timestamp, timestampUnit)),
    right: unlabelled.box.right,
  });

  const plot = timePlot({ ...layout, topInset: instantsInset(placedInstants) });
  const { box } = plot;

  function x(timestamp: number): number {
    return plot.x.position(toMilliseconds(timestamp, timestampUnit));
  }

  const y = plot.y.position;

  function describeRange(value: ChartRangeValue): string {
    return `${timeText(value[0])} to ${timeText(value[1])}`;
  }

  const rangeControl =
    onRangeChange !== undefined && rangeStep !== undefined && last !== first ? { onRangeChange, rangeStep } : undefined;

  const marks = timestamps.map((timestamp) => ({ id: String(timestamp), x: x(timestamp), y: 0 }));

  return (
    <div {...stylex.props(styles.frame)}>
      <Chart
        items={inspectionItems}
        readout={(id) => inspectionReadout(reading(Number(id)))}
        locate={locateNearest({ marks, width: box.width, height: box.height, axis: 'x' })}
        revision={signature}
        inspected={sharedInspection?.id}
        onInspectedChange={sharedInspection?.onChange}
        within={sharedInspection?.within}
        render={(figure, { inspected, cursor }) => {
          const active = inspected === null ? undefined : Number(inspected);
          const shown = reading(sharedInspection === undefined || sharedInspection.isSource ? active : undefined);

          const surface = (
            <PlotSurface
              plotRef={size.ref}
              box={box}
              label={plotLabel({ title, marks: 'observations', isSelectable: false })}
              readoutId={inspectionId}
            >
              <PlotAxes box={box} xTicks={showTimeAxis ? plot.xTicks : []} yTicks={plot.yTicks} yTitle={valueLabel} />
              <PlotClip box={box}>
                <TimeSeriesBands bands={preparedBands} x={x} y={y} />
                {prepared.map((item) => {
                  const line = item.points.map((point) => ({
                    x: x(point.timestamp),
                    y: point.value === null ? null : y(point.value + point.base),
                  }));

                  const area = item.points.map((point) => ({
                    x: x(point.timestamp),
                    y0: point.value === null ? null : y(point.base),
                    y1: point.value === null ? null : y(point.value + point.base),
                  }));

                  return (
                    <g key={item.id}>
                      {kind === 'area' && <AreaMark d={areaPath(area)} tone={item.tone} isPale={!isStacked} />}
                      <LineMark d={linePath(line)} tone={item.tone} />
                      {isolatedPoints(line).map((point) => (
                        <DotMark key={point.x} x={point.x} y={point.y} tone={item.tone} radius={ISOLATED_RADIUS_PX} />
                      ))}
                    </g>
                  );
                })}
                {crossings.map((crossing) => (
                  <RuleMark
                    key={crossing.id}
                    x1={box.left}
                    x2={box.right}
                    y1={y(crossing.value)}
                    y2={y(crossing.value)}
                  />
                ))}
                {markers.map((marker) => {
                  if (marker.kind === 'time') {
                    return <GuideMark key={marker.id} x={x(marker.timestamp)} top={box.top} bottom={box.bottom} />;
                  }

                  const base = prepared
                    .find((item) => item.id === marker.seriesId)
                    ?.points.find((point) => point.timestamp === marker.timestamp)?.base;

                  return marker.kind === 'point' ? (
                    <RingMark key={marker.id} x={x(marker.timestamp)} y={y(marker.value + (base ?? 0))} />
                  ) : undefined;
                })}
                {active !== undefined && <GuideMark x={x(active)} top={box.top} bottom={box.bottom} />}
                {active !== undefined &&
                  prepared.flatMap((item) => {
                    const point = item.points.find((candidate) => candidate.timestamp === active);

                    return point === undefined || point.value === null
                      ? []
                      : [
                          <DotMark
                            key={item.id}
                            x={x(point.timestamp)}
                            y={y(point.value + point.base)}
                            tone={item.tone}
                            isInspected
                          />,
                        ];
                  })}
              </PlotClip>
              <TimeInstants placed={placedInstants} x={x} y={y} top={box.top} bottom={box.bottom} />
              {cursor !== null && (
                <ChartCursor x={x(Number(cursor))} top={box.top} bottom={box.bottom} width={CURSOR_WIDTH_PX} />
              )}
            </PlotSurface>
          );

          return (
            <FigureFrame
              {...frame}
              figure={figure}
              titleDetail={hasSeriesSummary ? undefined : shown.label}
              series={legendSeries}
              seriesLegend={
                <ChartInspection
                  id={inspectionId}
                  label={shown.label}
                  legend={legendSeries}
                  rows={shown.rows}
                  x={x(active ?? first)}
                  width={box.width}
                  notes={shown.notes}
                  hasSeriesSummary={hasSeriesSummary}
                />
              }
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
                    timeText(point.timestamp),
                    ...prepared.map((item) => valueText(item.points[index]?.value ?? null)),
                    ...bandRows({ bands: preparedBands, timestamp: point.timestamp, valueText }).map(
                      (row) => row.value,
                    ),
                  ],
                }))}
              />
              <div {...stylex.props(styles.body)}>
                {rangeControl === undefined ? (
                  surface
                ) : (
                  <ChartRange
                    value={range}
                    onValueChange={rangeControl.onRangeChange}
                    min={first}
                    max={last}
                    step={rangeControl.rangeStep}
                    describe={describeRange}
                    label={`${title} time range`}
                    left={x(first)}
                    width={x(last) - x(first)}
                    height={box.bottom}
                  >
                    {surface}
                  </ChartRange>
                )}
                {rangeControl !== undefined && (
                  <div {...stylex.props(styles.range)}>
                    <span>
                      {range === null
                        ? 'Drag on the plot with a mouse to select a range of time.'
                        : `Selected range: ${describeRange(range)}`}
                    </span>
                    {range === null ? (
                      <TextButton
                        type="button"
                        onClick={(event) => {
                          dispatch(
                            { options: () => rangeControl },
                            'onRangeChange',
                            middleRange({ first, last, step: rangeControl.rangeStep }),
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
                          dispatch({ options: () => rangeControl }, 'onRangeChange', null, {
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
                        {timeText(marker.timestamp)} · {marker.label}
                        {marker.kind === 'point' && ` · ${valueText(marker.value)}`}
                      </li>
                    ))}
                    {foundCrossings.map((found) => (
                      <li key={found.crossing.id}>{crossingText({ found, timeText })}</li>
                    ))}
                  </ul>
                )}
              </div>
            </FigureFrame>
          );
        }}
      />
    </div>
  );
}

function rangeIssue({
  range,
  rangeStep,
  isSelectable,
  timeline,
}: {
  readonly range: ChartRangeValue | null;
  readonly rangeStep: number | undefined;
  readonly isSelectable: boolean;
  readonly timeline: ReadonlyArray<number>;
}): string | undefined {
  const first = timeline[0];
  const last = timeline.at(-1);

  if (!isSelectable || first === undefined || last === undefined) {
    return undefined;
  }

  const span = last - first;

  // One moment has no range to select, so the chart draws without the brush.
  if (span === 0) {
    return undefined;
  }

  const isStepMissing = rangeStep === undefined || !Number.isFinite(rangeStep);

  if (isStepMissing || rangeStep <= 0 || rangeStep > span) {
    return 'A selectable range needs a rangeStep that is finite, positive, and no longer than the observed time.';
  }

  if (range === null) {
    return undefined;
  }

  const isInside = range[0] >= first && range[1] <= last;

  if (!isInside || range[0] >= range[1]) {
    return 'The selected range must have ordered ends inside the observed time.';
  }

  return undefined;
}

/** The middle half of the observed time, snapped to the step: where a range starts when a reader asks for one. */
function middleRange({
  first,
  last,
  step,
}: {
  readonly first: number;
  readonly last: number;
  readonly step: number;
}): ChartRangeValue {
  const quarter = Math.max(1, Math.round((last - first) / QUARTERS / step)) * step;
  const start = Math.min(first + quarter, last - step);

  return [start, Math.min(last, Math.max(start + step, last - quarter))];
}
