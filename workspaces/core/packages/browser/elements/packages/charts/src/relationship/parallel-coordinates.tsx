import * as stylex from '@stylexjs/stylex';
import { bindDrag, dispatch, dragThreshold } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import { useEffect, useId, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { ChartData } from '../chart-data.tsx';
import { ChartLegend, ChartReadout } from '../chart-frame.tsx';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartPoint } from '../chart.tsx';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { isolatedPoints, linePath } from '../plot/path.ts';
import { axisTicks, plotBox, plotMargins } from '../plot/plot-layout.ts';
import type { PlotHeight } from '../plot/plot-layout.ts';
import { DotMark, LineMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { continuousScale, outsideDomain } from '../plot/scale.ts';
import type { ContinuousScale } from '../plot/scale.ts';
import {
  measureInputError,
  measureItems,
  measureTable,
  measureValue,
  resolveMeasureAxes,
  useMeasureTones,
} from './measures.ts';
import type { MeasureAxis, MeasureDimension, MeasureGroup, MeasureRow } from './measures.ts';
import { RangeControls } from './range-controls.tsx';
import type { AxisRangeReason, AxisRanges } from './range-controls.tsx';

export type { AxisRangeReason, AxisRanges } from './range-controls.tsx';

export type ParallelCoordinatesProps = FigureProps &
  FigureSelectionProps & {
    /** The measures, two to twelve, left to right. Each gets its own vertical axis, domain, scale and ticks. */
    readonly dimensions: ReadonlyArray<MeasureDimension>;
    /** The things measured. Each is one polyline. A missing value breaks the line at that axis. */
    readonly rows: ReadonlyArray<MeasureRow>;
    /** Names the sets rows belong to. Each group takes a hue. Without groups every row shares one. */
    readonly groups?: ReadonlyArray<MeasureGroup> | undefined;
    /** The value range kept on each axis. Rows outside any range are drawn as gray context. */
    readonly ranges?: AxisRanges | undefined;
    /** Asks the application to keep a range. Without it the ranges can be shown but not changed. */
    readonly onRangesChange?: ((ranges: AxisRanges, details: ChangeDetails<AxisRangeReason>) => void) | undefined;
    readonly height?: PlotHeight | undefined;
  };

export const parallelLimits = { dimensions: 12, rows: 500 } as const;

const styles = stylex.create({
  ink: { stroke: colors.ink, strokeWidth: 2.5, fill: 'none' },
  selected: { strokeWidth: 2 },
  brush: {
    fill: colors.ink,
    fillOpacity: 0.12,
    stroke: colors.ink,
    strokeWidth: 1,
    vectorEffect: 'non-scaling-stroke',
    pointerEvents: 'none',
  },
  hit: { fill: 'transparent', cursor: 'ns-resize' },
});

const CHARACTER_WIDTH = 7;
const LEFT_COMPACT = 16;
const SIDES_ESTIMATE = 140;
const RIGHT_BASE = 24;
const TOP_BASE = 32;
const TITLE_RISE = 18;
const TOP_MAXIMUM = 140;
const BOTTOM_MARGIN = 16;
const LABEL_SPACING_MINIMUM = 72;
const TITLE_GAP = 8;
const TITLE_ANGLE = 40;
const ANGLE_SINE = 0.64;
const ANGLE_COSINE = 0.77;
const RIGHT_SHARE_MAXIMUM = 0.3;
const TICK_LENGTH = 4;
const TICK_LABEL_INSET = 8;
const BASELINE_SHIFT = 4;
const TICK_SPACING = 48;
const AXIS_HIT = 10;
const BRUSH_WIDTH = 10;
const HALF = 0.5;
const DOT_RADIUS = 3;
const ISOLATED_RADIUS = 2;
const TICK_LABEL_HEIGHT = 18;

type AxisTick = { readonly value: number; readonly label: string };

/**
 * The ticks of one axis that keep a label's height apart, so labels never touch: log axes pack several ticks into a
 * decade.
 *
 * @yields Each tick that clears the one before it, from the first.
 */
function* spacedTicks({
  ticks,
  scale,
}: {
  readonly ticks: ReadonlyArray<AxisTick>;
  readonly scale: ContinuousScale;
}): Generator<AxisTick> {
  const state = { last: Number.NEGATIVE_INFINITY };

  for (const tick of ticks) {
    const at = scale.position(tick.value);

    if (Math.abs(at - state.last) >= TICK_LABEL_HEIGHT) {
      state.last = at;
      yield tick;
    }
  }
}

function rangesError({ ranges, axes }: { readonly ranges: AxisRanges; readonly axes: ReadonlyArray<MeasureAxis> }) {
  const entries = Object.entries(ranges);
  const unknown = entries.find(([id]) => !axes.some((axis) => axis.id === id));

  if (unknown !== undefined) {
    return `A range names the dimension ${unknown[0]}, which was not supplied.`;
  }

  const invalid = entries.find(([id, range]) => {
    const domain = axes.find((axis) => axis.id === id)?.domain;

    const isInverted = range[0] > range[1];
    const isOutside = domain !== undefined && (outsideDomain(range[0], domain) || outsideDomain(range[1], domain));

    return isInverted || isOutside;
  });

  return invalid === undefined
    ? undefined
    : `The range on ${invalid[0]} is not finite, is reversed or lies outside its domain.`;
}

function isInRange({
  row,
  axes,
  ranges,
}: {
  readonly row: MeasureRow;
  readonly axes: ReadonlyArray<MeasureAxis>;
  readonly ranges: AxisRanges;
}): boolean {
  return axes.every((axis) => {
    const range = ranges[axis.id];
    const value = measureValue(row, axis);

    if (range === undefined) {
      return true;
    }

    return value !== null && value >= range[0] && value <= range[1];
  });
}

/**
 * Many measures per item on parallel vertical axes, one line per row: the way to read a hyperparameter sweep. Drag on
 * an axis, or type bounds under the plot, to keep a range; rows outside every range turn gray. Use it to find which
 * settings go with a good result, with the ranges and any selected row held by the application.
 */
export function ParallelCoordinates(props: ParallelCoordinatesProps): ReactNode {
  const {
    dimensions,
    rows,
    groups = [],
    ranges = {},
    onRangesChange,
    height = 'regular',
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No rows are available.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize(height);
  const readoutId = useId();
  const link = useLinkedInspection();
  const { toneOf, groupLabel, legend } = useMeasureTones(groups);

  const [gesture, setGesture] = useState<{ readonly id: string; readonly range: readonly [number, number] } | null>(
    null,
  );

  const releaseDrag = useRef<(() => void) | null>(null);

  useEffect(() => () => releaseDrag.current?.(), []);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height={height} />;
  }

  const axes = resolveMeasureAxes({ dimensions, rows });
  const inputError = measureInputError({ axes, rows, groups, limits: parallelLimits }) ?? rangesError({ ranges, axes });

  if (inputError !== undefined) {
    return <FigureInvalid {...frame} message={inputError} />;
  }

  const shownRanges: AxisRanges = gesture === null ? ranges : { ...ranges, [gesture.id]: gesture.range };
  const count = axes.length;
  const roughStep = (size.width - SIDES_ESTIMATE) / (count - 1);
  const hasTickLabels = roughStep >= LABEL_SPACING_MINIMUM;

  const ticks = axes.map((axis) => {
    const { values, labels } = axisTicks({
      axis,
      domain: axis.domain,
      length: size.height,
      spacing: TICK_SPACING,
      locale,
      hasTitle: true,
    });

    return values.map((value, index) => ({ value, label: labels[index] ?? '' }));
  });

  const tickWidth = hasTickLabels
    ? plotMargins({
        width: size.width,
        valueLabels: ticks.flatMap((own) => own.map((tick) => tick.label)),
        hasXTitle: false,
        hasYTitle: false,
      }).left
    : LEFT_COMPACT;

  const isRotated = axes.some((axis) => axis.label.length * CHARACTER_WIDTH > roughStep - TITLE_GAP);
  const longest = Math.max(0, ...axes.map((axis) => axis.label.length));
  const rotatedRise = isRotated ? Math.ceil(longest * CHARACTER_WIDTH * ANGLE_SINE) : 0;
  const firstLength = isRotated ? 0 : (axes[0]?.label.length ?? 0);
  const lastLength = axes[count - 1]?.label.length ?? 0;
  const lastReach = isRotated ? lastLength * ANGLE_COSINE : lastLength * HALF;
  const left = Math.max(tickWidth, Math.ceil(firstLength * CHARACTER_WIDTH * HALF));

  const right = Math.max(
    RIGHT_BASE,
    Math.min(size.width * RIGHT_SHARE_MAXIMUM, Math.ceil(lastReach * CHARACTER_WIDTH)),
  );

  const top = Math.min(TOP_MAXIMUM, TOP_BASE + rotatedRise);

  const box = plotBox({
    width: size.width,
    height: size.height + top - TOP_BASE,
    margins: { top, right, bottom: BOTTOM_MARGIN, left },
  });

  const step = box.innerWidth / (count - 1);

  const placed = axes.map((axis, index) => {
    const scale = continuousScale({ type: axis.scale, domain: axis.domain, range: [box.bottom, box.top] });

    return {
      axis,
      x: box.left + index * step,
      scale,
      ticks: Array.from(spacedTicks({ ticks: ticks[index] ?? [], scale })),
    };
  });

  const lines = rows.map((row) => {
    const ys = placed.map((entry) => {
      const value = measureValue(row, entry.axis);

      return value === null ? null : entry.scale.position(value);
    });

    const points = placed.map((entry, index) => ({ x: entry.x, y: ys[index] ?? null }));

    return {
      row,
      ys,
      d: linePath(points),
      dots: isolatedPoints(points),
      isMatch: isInRange({ row, axes, ranges: shownRanges }),
    };
  });

  const items = measureItems({ rows, axes, locale, groupLabel, consequence: 'the line breaks at those axes.' });

  const matching = lines.filter((line) => line.isMatch);

  function commit({
    next,
    reason,
    event,
  }: {
    readonly next: AxisRanges;
    readonly reason: AxisRangeReason;
    readonly event?: Event;
  }): void {
    dispatch(
      { options: () => ({ onRangesChange }) },
      'onRangesChange',
      next,
      event === undefined ? { reason } : { reason, event },
    );
  }

  function locate(point: ChartPoint): string | undefined {
    const x = (point.x / point.width) * box.width;
    const y = (point.y / point.height) * box.height;
    const place = Math.min(count - 1, Math.max(0, (x - box.left) / step));
    const index = Math.min(count - 2, Math.floor(place));
    const along = place - index;
    const candidates = matching.length > 0 ? matching : lines;

    const distances = candidates.flatMap((line) => {
      const before = line.ys[index] ?? null;
      const after = line.ys[index + 1] ?? null;
      const nearer = along < HALF ? before : after;
      const at = before !== null && after !== null ? before + (after - before) * along : nearer;

      return at === null ? [] : [{ id: line.row.id, distance: Math.abs(at - y) }];
    });

    return distances.toSorted((first, second) => first.distance - second.distance)[0]?.id;
  }

  function startBrush(event: PointerEvent<SVGSVGElement>): void {
    const isBrushPress = event.button === 0 && event.pointerType !== 'touch';
    const svg = event.currentTarget;
    const container = svg.parentElement;

    if (onRangesChange === undefined || releaseDrag.current !== null || !isBrushPress) {
      return;
    }

    if (container === null) {
      return;
    }

    const bounds = svg.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * box.width;
    const entry = placed.find((candidate) => Math.abs(candidate.x - x) <= AXIS_HIT);

    if (entry === undefined) {
      return;
    }

    function valueAtClient(clientY: number): number {
      const y = ((clientY - bounds.top) / bounds.height) * box.height;

      return entry?.scale.valueAt(Math.min(box.bottom, Math.max(box.top, y))) ?? 0;
    }

    const start = valueAtClient(event.clientY);
    const drag = { hasMoved: false };

    function rangeTo(clientY: number): readonly [number, number] {
      const end = valueAtClient(clientY);

      return [Math.min(start, end), Math.max(start, end)];
    }

    releaseDrag.current = bindDrag(container, event.nativeEvent, {
      threshold: dragThreshold,
      cancelOnEscape: true,
      onMove: ({ y }) => {
        drag.hasMoved = true;

        setGesture({ id: entry.axis.id, range: rangeTo(y) });
      },
      onEnd: (up, isCanceled) => {
        releaseDrag.current = null;

        setGesture(null);

        const range = rangeTo(up.clientY);

        if (!isCanceled && drag.hasMoved && range[0] < range[1]) {
          commit({ next: { ...ranges, [entry.axis.id]: range }, reason: 'drag', event: up });
        }
      },
    });
  }

  return (
    <Chart
      {...link}
      items={items}
      locate={locate}
      selected={selected}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, selected: selectedId, cursor }) => {
        const inspectedLine = lines.find((line) => line.row.id === inspected);
        const selectedLine = lines.find((line) => line.row.id === selectedId);
        const cursorLine = lines.find((line) => line.row.id === cursor);
        const emphasis = inspected === null ? 'normal' : 'receded';

        return (
          <FigureFrame
            {...frame}
            figure={figureProps}
            series={legend}
            seriesLegend={legend.length > 0 ? <ChartLegend items={legend} /> : undefined}
            footer={
              rows.length === 0 ? undefined : (
                <>
                  <ChartReadout id={readoutId}>{inspectedLabel(items, inspected ?? selectedId)}</ChartReadout>
                  <RangeControls
                    axes={axes}
                    ranges={shownRanges}
                    locale={locale}
                    matching={matching.length}
                    total={rows.length}
                    onChange={(next, reason) => commit({ next, reason })}
                  />
                </>
              )
            }
          >
            {rows.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={size.ref}
                  box={box}
                  label={plotLabel({ title, marks: 'rows', isSelectable: onSelectedChange !== undefined })}
                  readoutId={readoutId}
                  onPointerDown={startBrush}
                >
                  {placed.map((entry) => (
                    <g key={entry.axis.id}>
                      <line
                        x1={entry.x}
                        x2={entry.x}
                        y1={box.top}
                        y2={box.bottom}
                        {...stylex.props(chartStyles.axis)}
                      />
                      {entry.ticks.map((tick) => (
                        <line
                          key={tick.value}
                          x1={entry.x - TICK_LENGTH}
                          x2={entry.x}
                          y1={entry.scale.position(tick.value)}
                          y2={entry.scale.position(tick.value)}
                          {...stylex.props(chartStyles.axis)}
                        />
                      ))}
                    </g>
                  ))}
                  <PlotClip box={box}>
                    {lines
                      .toSorted((first, second) => Number(first.isMatch) - Number(second.isMatch))
                      .map((line) => (
                        <g key={line.row.id}>
                          <LineMark d={line.d} tone={toneOf(line.row)} emphasis={line.isMatch ? emphasis : 'context'} />
                          {line.dots.map((dot) => (
                            <DotMark
                              key={dot.x}
                              x={dot.x}
                              y={dot.y}
                              tone={toneOf(line.row)}
                              radius={ISOLATED_RADIUS}
                              emphasis={line.isMatch ? emphasis : 'context'}
                            />
                          ))}
                        </g>
                      ))}
                    {[selectedLine, inspectedLine].map((line) =>
                      line === undefined ? null : (
                        <path
                          key={line.row.id}
                          d={line.d}
                          {...stylex.props(chartStyles.mark, styles.ink, line !== inspectedLine && styles.selected)}
                        />
                      ),
                    )}
                    {inspectedLine?.ys.map((y, index) =>
                      y === null ? null : (
                        <DotMark
                          key={placed[index]?.axis.id}
                          x={placed[index]?.x ?? 0}
                          y={y}
                          tone={toneOf(inspectedLine.row)}
                          radius={DOT_RADIUS}
                          isInspected
                        />
                      ),
                    )}
                    {cursorLine !== undefined && (
                      <path d={cursorLine.d} fill="none" {...stylex.props(chartStyles.shapeCursor)} />
                    )}
                  </PlotClip>
                  {placed.map((entry) => (
                    <g key={entry.axis.id}>
                      {hasTickLabels &&
                        entry.ticks.map((tick) => (
                          <text
                            key={tick.value}
                            x={entry.x - TICK_LABEL_INSET}
                            y={entry.scale.position(tick.value) + BASELINE_SHIFT}
                            textAnchor="end"
                            {...stylex.props(chartStyles.label, chartStyles.tick, chartStyles.haloLabel)}
                          >
                            {tick.label}
                          </text>
                        ))}
                      <text
                        x={entry.x}
                        y={box.top - TITLE_RISE}
                        textAnchor={isRotated ? 'start' : 'middle'}
                        transform={isRotated ? `rotate(-${TITLE_ANGLE} ${entry.x} ${box.top - TITLE_RISE})` : undefined}
                        {...stylex.props(chartStyles.label, chartStyles.strongLabel)}
                      >
                        {entry.axis.label}
                      </text>
                    </g>
                  ))}
                  {placed.map((entry) => {
                    const range = shownRanges[entry.axis.id];

                    return (
                      <g key={entry.axis.id}>
                        {range !== undefined && (
                          <rect
                            x={entry.x - BRUSH_WIDTH / 2}
                            y={entry.scale.position(range[1])}
                            width={BRUSH_WIDTH}
                            height={entry.scale.position(range[0]) - entry.scale.position(range[1])}
                            {...stylex.props(styles.brush)}
                          />
                        )}
                        {onRangesChange !== undefined && (
                          <rect
                            x={entry.x - AXIS_HIT}
                            y={box.top}
                            width={AXIS_HIT * 2}
                            height={box.innerHeight}
                            {...stylex.props(styles.hit)}
                          />
                        )}
                      </g>
                    );
                  })}
                </PlotSurface>
                <ChartData label={`${title} rows`} {...measureTable({ rows, axes, locale })} />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
