import * as stylex from '@stylexjs/stylex';
import { scaleLinear } from '@visx/scale';
import { AreaClosed } from '@visx/shape';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { colors, controls, spacing, typography } from '../../../core/src/tokens.stylex.ts';
import { ChartDataDisclosure, ChartFrame, ChartLegend } from '../chart-frame.tsx';
import { ChartInputError, hasUniqueIds } from '../chart-input.tsx';
import { chartStyles, chartToneColors } from '../chart-theme.ts';
import { usePlotWidth } from '../plot-width.ts';
import {
  observationDomain,
  prepareTimeSeries,
  timeSeriesLimits,
  timeSeriesSignature,
  validateTimeSeries,
} from './time-series-data.ts';
import type { PlotPoint, TimeSeries, TimeSeriesMarker } from './time-series-data.ts';
import { TimeSeriesLine } from './time-series-line.tsx';

export type TimeSeriesChartProps = {
  readonly title: string;
  readonly description?: string | undefined;
  readonly series: ReadonlyArray<TimeSeries>;
  readonly timestampUnit: 'seconds' | 'milliseconds';
  readonly formatTimestamp: (timestamp: number) => string;
  readonly formatValue: (value: number) => string;
  readonly markers?: ReadonlyArray<TimeSeriesMarker> | undefined;
  readonly height?: number | undefined;
  readonly actions?: ReactNode;
};

export type AreaChartProps = TimeSeriesChartProps & { readonly stacked?: boolean | undefined };

export type SmallMultiplesProps = Omit<
  TimeSeriesChartProps,
  'series' | 'title' | 'description' | 'actions' | 'formatValue' | 'markers'
> & {
  readonly charts: ReadonlyArray<{
    readonly id: string;
    readonly title: string;
    readonly series: ReadonlyArray<TimeSeries>;
    readonly description?: string | undefined;
    readonly formatValue: (value: number) => string;
    readonly markers?: ReadonlyArray<TimeSeriesMarker> | undefined;
  }>;
};

type Inspection = { readonly signature: string; readonly timestamp: number; readonly source: 'pointer' | 'keyboard' };

type SharedInspection = {
  readonly value: Inspection | undefined;
  readonly onChange: (value: Inspection | undefined) => void;
};

const styles = stylex.create({
  frame: { minWidth: 0 },
  plot: {
    'minWidth': 0,
    'outlineOffset': 2,
    ':focus-visible': { outlineColor: colors.focus, outlineStyle: 'solid', outlineWidth: controls.focusWidth },
  },
  body: { display: 'grid', gap: spacing.md },
  inspection: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    fontSize: typography.captionSize,
    lineHeight: typography.captionLineHeight,
    minHeight: typography.captionLineHeight,
  },
  values: { display: 'flex', flexWrap: 'wrap', gap: spacing.md, margin: 0 },
  value: { display: 'flex', gap: spacing.xs, margin: 0, fontVariantNumeric: 'tabular-nums' },
  valueText: { margin: 0, color: colors.ink },
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
    fontWeight: 400,
  },
  multiples: { display: 'grid', gap: spacing.xl },
  guide: { stroke: colors.muted, strokeDasharray: '3 3', vectorEffect: 'non-scaling-stroke' },
});

export function LineChart(props: TimeSeriesChartProps): ReactNode {
  return <TimeChart {...props} kind="line" stacked={false} />;
}

export function AreaChart({ stacked = false, ...props }: AreaChartProps): ReactNode {
  return <TimeChart {...props} kind="area" stacked={stacked} />;
}

export function SmallMultiples({ charts, ...props }: SmallMultiplesProps): ReactNode {
  const root = useRef<HTMLDivElement>(null);
  const [inspection, setInspection] = useState<Inspection | undefined>();

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

  const sharedInspection = {
    value: inspection?.signature === signature ? inspection : undefined,
    onChange: (value: Inspection | undefined): void =>
      setInspection(value === undefined ? undefined : { ...value, signature }),
  };

  const axisWidth = Math.max(
    52,
    ...charts.flatMap((chart) =>
      chart.series.flatMap((series) =>
        series.points.flatMap((point) =>
          point.value === null || !Number.isFinite(point.value) ? [] : [chart.formatValue(point.value).length * 7 + 12],
        ),
      ),
    ),
  );

  return (
    <div ref={root} {...stylex.props(styles.multiples)}>
      {charts.map((chart) => (
        <TimeChart
          key={chart.id}
          {...props}
          title={chart.title}
          description={chart.description}
          series={chart.series}
          formatValue={chart.formatValue}
          markers={chart.markers}
          kind="line"
          stacked={false}
          sharedInspection={sharedInspection}
          axisWidth={axisWidth}
        />
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
  markers = [],
  height = 180,
  actions,
  kind,
  stacked,
  sharedInspection,
  axisWidth,
}: TimeSeriesChartProps & {
  readonly kind: 'line' | 'area';
  readonly stacked: boolean;
  readonly sharedInspection?: SharedInspection;
  readonly axisWidth?: number;
}): ReactNode {
  const issue =
    !Number.isFinite(height) || height < 48
      ? 'Chart height must be at least 48 pixels.'
      : validateTimeSeries({ series, isStacked: stacked, markers });

  const prepared = useMemo(
    () => (issue === undefined ? prepareTimeSeries(series, stacked) : []),
    [series, stacked, issue],
  );

  const points = prepared[0]?.points ?? [];
  const { ref, width, element } = usePlotWidth();
  const rootRef = useRef<HTMLDivElement>(null);
  const [inspection, setInspection] = useState<Inspection | undefined>();
  const signature = timeSeriesSignature({ series, markers, timestampUnit, isStacked: stacked });

  const active =
    sharedInspection === undefined
      ? inspection?.signature === signature
        ? inspection
        : undefined
      : sharedInspection.value;

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
    return <ChartInputError title={title} description={description} message={issue} />;
  }

  if (points.length === 0) {
    return (
      <ChartFrame title={title} description={description} actions={actions}>
        <p {...stylex.props(styles.muted)}>No observations</p>
      </ChartFrame>
    );
  }

  const top = 12;
  const bottom = height - 28;
  const first = points[0]?.timestamp ?? 0;
  const last = points.at(-1)?.timestamp ?? first;

  const observed = prepared.flatMap((item) =>
    item.points.flatMap((point) => (point.value === null ? [] : [point.value + point.base])),
  );

  const minimum = kind === 'area' ? Math.min(0, ...observed) : Math.min(...observed);
  const maximum = kind === 'area' ? Math.max(0, ...observed) : Math.max(...observed);
  const low = observed.length === 0 ? 0 : minimum;
  const high = observed.length === 0 ? 1 : maximum;
  const y = scaleLinear({ domain: [...observationDomain(low, high, kind === 'area')], range: [bottom, top] });
  const yTicks = y.ticks(3);
  const left = axisWidth ?? Math.max(52, ...yTicks.map((tick) => formatValue(tick).length * 7 + 12));
  const right = Math.max(left + 1, width - 16);
  const x = scaleLinear({ domain: [...observationDomain(first, last)], range: [left, right] });

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

  function inspectKey(event: KeyboardEvent<SVGSVGElement>): void {
    const currentIndex = points.findIndex((point) => point.timestamp === active?.timestamp);

    const navigation = {
      ArrowRight: Math.min(points.length - 1, currentIndex + 1),
      ArrowLeft: Math.max(0, currentIndex - 1),
      Home: 0,
      End: points.length - 1,
    };

    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        updateInspection(undefined);

        break;
      case 'ArrowRight':
      case 'ArrowLeft':
      case 'Home':
      case 'End': {
        event.preventDefault();

        const point = points[navigation[event.key]];

        if (point !== undefined) {
          updateInspection({ signature, timestamp: point.timestamp, source: 'keyboard' });
        }

        break;
      }
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} {...stylex.props(styles.frame)}>
      <ChartFrame title={title} description={description} actions={actions}>
        <div {...stylex.props(styles.body)}>
          <ChartLegend items={prepared.map(({ id, label, tone }) => ({ id, label, tone }))} />
          <div ref={ref} {...stylex.props(chartStyles.plot)}>
            <svg
              role="img"
              aria-label={`${title}. Use arrow keys to inspect observations.`}
              aria-describedby={inspectionId}
              tabIndex={0}
              viewBox={`0 0 ${width} ${height}`}
              height={height}
              onKeyDown={inspectKey}
              onPointerMove={(event) => {
                if (event.pointerType === 'mouse') {
                  inspectClient(event.clientX);
                }
              }}
              onPointerDown={(event) => inspectClient(event.clientX)}
              {...stylex.props(chartStyles.svg, styles.plot)}
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
                    {formatValue(tick)}
                  </text>
                </g>
              ))}
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
                      fillOpacity={stacked ? 0.65 : 0.15}
                    />
                  )}
                  <TimeSeriesLine series={item} x={x} y={y} inspectedTimestamp={active?.timestamp} />
                </g>
              ))}
              {markers.map((marker) => (
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
              <text x={left} y={height - 4} {...stylex.props(chartStyles.label)}>
                {formatTimestamp(first)}
              </text>
              {last !== first && (
                <text x={right} y={height - 4} textAnchor="end" {...stylex.props(chartStyles.label)}>
                  {formatTimestamp(last)}
                </text>
              )}
            </svg>
          </div>
          <div
            id={inspectionId}
            aria-live={active?.source === 'keyboard' ? 'polite' : 'off'}
            {...stylex.props(styles.inspection)}
          >
            {active === undefined ? (
              <span {...stylex.props(styles.muted)}>Point, tap, or use the arrow keys to inspect values.</span>
            ) : (
              <>
                <span>{formatTimestamp(active.timestamp)}</span>
                <dl {...stylex.props(styles.values)}>
                  {prepared.map((item) => {
                    const point = item.points.find((value) => value.timestamp === active.timestamp);

                    return (
                      <div key={item.id} {...stylex.props(styles.value)}>
                        <dt>{item.label}</dt>
                        <dd {...stylex.props(styles.valueText)}>
                          {point?.value === null || point === undefined ? 'Unavailable' : formatValue(point.value)}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
                {markers
                  .filter((marker) => marker.timestamp === active.timestamp)
                  .map((marker) => (
                    <span key={marker.id}>{marker.label}</span>
                  ))}
              </>
            )}
          </div>
          {markers.length > 0 && (
            <ul {...stylex.props(styles.markerList)}>
              {markers.map((marker) => (
                <li key={marker.id}>
                  {formatTimestamp(marker.timestamp)} · {marker.label}
                  {marker.kind === 'point' && ` · ${formatValue(marker.value)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
        <ChartDataDisclosure>
          <table {...stylex.props(styles.table)}>
            <caption>{title} observations</caption>
            <thead>
              <tr>
                <th {...stylex.props(styles.cell)}>Time ({timestampUnit})</th>
                {prepared.map((item) => (
                  <th key={item.id} scope="col" {...stylex.props(styles.cell)}>
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((point, index) => (
                <tr key={point.timestamp}>
                  <th scope="row" {...stylex.props(styles.cell)}>
                    {formatTimestamp(point.timestamp)}
                  </th>
                  {prepared.map((item) => (
                    <td key={item.id} {...stylex.props(styles.cell)}>
                      {item.points[index]?.value === null || item.points[index]?.value === undefined
                        ? 'Unavailable'
                        : formatValue(item.points[index].value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </ChartDataDisclosure>
      </ChartFrame>
    </div>
  );
}
