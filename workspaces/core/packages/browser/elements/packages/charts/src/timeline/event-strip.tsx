import * as stylex from '@stylexjs/stylex';
import { stackSpans } from '@ui-sdk/core';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Row } from '../../../core/src/index.ts';
import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import { ChartCursor } from '../chart-cursor.tsx';
import { ChartData } from '../chart-data.tsx';
import { ChartReadout } from '../chart-frame.tsx';
import { hasUniqueIds } from '../chart-input.ts';
import { useLinkedInspection } from '../chart-link.tsx';
import { chartStyles } from '../chart-theme.ts';
import { Chart, inspectedLabel, plotLabel } from '../chart.tsx';
import type { ChartPoint } from '../chart.tsx';
import { formatTime, formatValue } from '../figure/figure-format.ts';
import type { TimeFormat } from '../figure/figure-format.ts';
import { FigureEmpty, FigureFrame, FigureInvalid, FigureLoading } from '../figure/figure-frame.tsx';
import type { FigureProps, FigureSelectionProps } from '../figure/figure-props.ts';
import { useTones } from '../figure/tone-scope.tsx';
import { locateNearest } from '../plot/locate.ts';
import { PlotAxes } from '../plot/plot-axes.tsx';
import { plotBox, plotMargins, timeAxisTicks } from '../plot/plot-layout.ts';
import type { PlotTick } from '../plot/plot-layout.ts';
import { BarMark, DotMark, LabelMark, RuleMark } from '../plot/plot-marks.tsx';
import { PlotClip, PlotSurface, usePlotSize } from '../plot/plot-surface.tsx';
import { continuousScale, outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';

/** A row of the strip, such as deploys, incidents or evaluation runs. */
export type EventStripLane = {
  readonly id: string;
  readonly label: string;
  /** The hue of the lane's events. Absent takes the lane's automatic tone. */
  readonly tone?: ChartTone | undefined;
};

/** Something that happened: at one instant when it has no `end`, or over an interval when it has one. */
export type EventStripItem = {
  readonly id: string;
  readonly laneId: string;
  readonly label: string;
  /** The instant it started, in milliseconds since the epoch. */
  readonly start: number;
  /** The instant it ended, after `start`. Leave it out for an event without duration, such as an alert. */
  readonly end?: number | undefined;
  /** A hue that overrides the lane's, such as a failed run in the negative tone. */
  readonly tone?: ChartTone | undefined;
  readonly detail?: string | undefined;
};

/** An instant drawn as a dashed rule across every lane, such as a release cut or a freeze. */
export type EventStripMarker = { readonly id: string; readonly label: string; readonly at: number };

/** A quick time-range preset shown in the strip header, such as 6h, 24h, or All. */
export type EventStripWindow = {
  readonly id: string;
  readonly label: string;
  /** Duration in milliseconds from the end of the strip domain, or `null` for the full span. */
  readonly durationMs: number | null;
};

/**
 * How the strip writes instants. Options name their own time zone; a function format needs `timeZone` beside it, so the
 * axis ticks fall on that zone's clock.
 */
export type EventStripTime =
  | { readonly timeFormat: Exclude<TimeFormat, (timestamp: number) => string>; readonly timeZone?: undefined }
  | { readonly timeFormat: (timestamp: number) => string; readonly timeZone: string };

export type EventStripProps = FigureProps &
  FigureSelectionProps &
  EventStripTime & {
    readonly lanes: ReadonlyArray<EventStripLane>;
    readonly events: ReadonlyArray<EventStripItem>;
    /** First and last instant the strip spans in epoch ms. Absent fits events and markers automatically. */
    readonly domain?: NumericDomain | undefined;
    readonly markers?: ReadonlyArray<EventStripMarker> | undefined;
    /** Optional time-window presets rendered in the figure header. */
    readonly windows?: ReadonlyArray<EventStripWindow> | undefined;
    readonly defaultWindowId?: string | undefined;
    /**
     * The lane-label gutter's width in pixels, which strips stacked in a column pass the same from `eventStripGutter`
     * over all their lanes so their time axes line up. A label longer than the gutter is cut with an ellipsis and keeps
     * its full text in a title. Absent fits this strip's own labels.
     */
    readonly gutterWidth?: number | undefined;
  };

export const eventStripLimits = { lanes: 12, events: 1000 } as const;

const ROW_HEIGHT = 22;
const LANE_PADDING = 6;
const BAR_HEIGHT = 14;
const BAR_WIDTH_MIN = 3;
const POINT_RADIUS = 5;
const POINT_EXTENT = 14;
const HIT_SLOP = 4;
const MARKER_BAND = 18;
const MARKER_LABEL_GAP = 4;
const CHARACTER_WIDTH = 6.5;
const CURSOR_WIDTH = 12;
const HALF = 0.5;
const AUTO_DOMAIN_PAD_RATIO = 0.04;
const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const secondUnit = { unit: 'second', size: SECOND } as const;

const durationUnits = [
  { unit: 'day', size: DAY },
  { unit: 'hour', size: HOUR },
  { unit: 'minute', size: MINUTE },
  secondUnit,
] as const;

const styles = stylex.create({ separator: { pointerEvents: 'none' } });

/**
 * The lane-label gutter that holds every listed label, in pixels. Pass the result as `gutterWidth` to each strip of a
 * column, with the lane labels of all of them, so their time axes start at the same place.
 */
export function eventStripGutter(labels: ReadonlyArray<string>): number {
  return plotMargins({ width: Number.POSITIVE_INFINITY, valueLabels: labels, hasXTitle: true, hasYTitle: false }).left;
}

function durationText(duration: number, locale: string): string {
  const chosen = durationUnits.find((candidate) => duration >= candidate.size) ?? secondUnit;

  return formatValue({
    value: duration / chosen.size,
    locale,
    format: { style: 'unit', unit: chosen.unit, unitDisplay: 'long', maximumFractionDigits: 1 },
  });
}

function autoStripDomain(
  events: ReadonlyArray<EventStripItem>,
  markers: ReadonlyArray<EventStripMarker>,
): NumericDomain {
  const instants = [
    ...events.flatMap((event) => (event.end === undefined ? [event.start] : [event.start, event.end])),
    ...markers.map((marker) => marker.at),
  ];

  if (instants.length === 0) {
    return [0, HOUR];
  }

  const minInstant = Math.min(...instants);
  const maxInstant = Math.max(...instants);
  const span = maxInstant - minInstant;
  const pad = span > 0 ? Math.max(MINUTE, Math.round(span * AUTO_DOMAIN_PAD_RATIO)) : HOUR * HALF;

  return [minInstant - pad, maxInstant + pad];
}

function eventStripInputError({
  lanes,
  events,
  markers,
  domain,
  zone,
}: Pick<EventStripProps, 'lanes' | 'events'> & {
  readonly domain: NumericDomain;
  readonly markers: ReadonlyArray<EventStripMarker>;
  readonly zone: string | undefined;
}): string | undefined {
  const domainError = scaleDomainError(domain);

  if (domainError !== undefined) {
    return domainError;
  }

  if (zone === undefined) {
    return 'A function time format needs a timeZone beside it, so the axis ticks fall on that zone.';
  }

  if (lanes.length > eventStripLimits.lanes || events.length > eventStripLimits.events) {
    return `This strip draws at most ${eventStripLimits.lanes} lanes and ${eventStripLimits.events} events. Supply a shorter window.`;
  }

  if (!hasUniqueIds(lanes) || !hasUniqueIds(events) || !hasUniqueIds(markers)) {
    return 'Lanes, events and markers must each have unique identifiers.';
  }

  const laneIds = new Set(lanes.map((lane) => lane.id));
  const stray = events.find((event) => !laneIds.has(event.laneId));

  if (stray !== undefined) {
    return `Event ${stray.id} names lane ${stray.laneId}, which is not supplied.`;
  }

  const outside = events.find((event) => {
    const isEndOutside = event.end !== undefined && (outsideDomain(event.end, domain) || event.end <= event.start);

    return outsideDomain(event.start, domain) || isEndOutside;
  });

  if (outside !== undefined) {
    return `Event ${outside.id} must start inside the domain and, when it has an end, end after its start inside the domain.`;
  }

  return markers.some((marker) => outsideDomain(marker.at, domain)) ? 'A marker lies outside the domain.' : undefined;
}

/**
 * Events along time in a few lanes: deploys, incidents, evaluation runs and alerts. An instant is a dot and an interval
 * a bar, and events that overlap in a lane stack into rows. Dashed rules mark supplied instants across every lane, and
 * the arrow keys step through events in time while Up and Down move to a neighboring lane.
 */
export function EventStrip(props: EventStripProps): ReactNode {
  const {
    lanes,
    events: rawEvents,
    domain: suppliedDomain,
    markers: rawMarkers = [],
    windows,
    defaultWindowId,
    gutterWidth,
    timeFormat,
    timeZone,
    selected,
    onSelectedChange,
    ...figure
  } = props;

  const { emptyLabel = 'No events in this window.', ...frame } = figure;
  const { locale, title } = frame;
  const size = usePlotSize('compact');
  const readoutId = useId();
  const tones = useTones();
  const link = useLinkedInspection();
  const firstWindowId = windows?.[0]?.id ?? '';
  const [activeWindowId, setActiveWindowId] = useState<string>(() => defaultWindowId ?? firstWindowId);

  if (frame.status === 'loading') {
    return <FigureLoading {...frame} height="compact" />;
  }

  const normalizedEvents = rawEvents.map((event) =>
    event.end !== undefined && event.end <= event.start ? { ...event, end: undefined } : event,
  );

  const baseDomain = suppliedDomain ?? autoStripDomain(normalizedEvents, rawMarkers);

  const activeWindow =
    windows === undefined || windows.length === 0
      ? undefined
      : (windows.find((candidate) => candidate.id === activeWindowId) ?? windows[0]);

  const activeDurationMs = activeWindow?.durationMs ?? null;
  const isWindowed = activeDurationMs !== null && activeDurationMs > 0;

  const domain: NumericDomain = isWindowed
    ? [Math.max(baseDomain[0], baseDomain[1] - activeDurationMs), baseDomain[1]]
    : baseDomain;

  const events = isWindowed
    ? normalizedEvents.flatMap((event) => {
        const eventEnd = event.end ?? event.start;

        if (eventEnd < domain[0] || event.start > domain[1]) {
          return [];
        }

        const clampedStart = Math.max(domain[0], event.start);
        const clampedEnd = event.end === undefined ? undefined : Math.min(domain[1], event.end);
        const nextEnd = clampedEnd !== undefined && clampedEnd > clampedStart ? clampedEnd : undefined;

        return [{ ...event, start: clampedStart, end: nextEnd }];
      })
    : normalizedEvents;

  const markers = isWindowed
    ? rawMarkers.filter((marker) => marker.at >= domain[0] && marker.at <= domain[1])
    : rawMarkers;

  const zone = typeof timeFormat === 'function' ? timeZone : timeFormat.timeZone;
  const inputError = eventStripInputError({ lanes, events, markers, domain, zone });

  if (inputError !== undefined || zone === undefined) {
    return <FigureInvalid {...frame} message={inputError ?? 'The strip needs a time zone.'} />;
  }

  const windowActions =
    windows === undefined || windows.length <= 1 ? (
      frame.actions
    ) : (
      <Row>
        {windows.map((windowOption) => {
          const isCurrent = windowOption.id === activeWindow?.id;

          return (
            <Button
              key={windowOption.id}
              type="button"
              density="compact"
              variant={isCurrent ? 'outline' : 'ghost'}
              aria-pressed={isCurrent}
              onClick={() => setActiveWindowId(windowOption.id)}
            >
              {windowOption.label}
            </Button>
          );
        })}
        {frame.actions}
      </Row>
    );

  function timeText(timestamp: number): string {
    return formatTime({ timestamp, locale, format: timeFormat });
  }

  const fitted = plotMargins({
    width: size.width,
    valueLabels: lanes.map((lane) => lane.label),
    hasXTitle: true,
    hasYTitle: false,
  });

  const margins = gutterWidth === undefined ? fitted : { ...fitted, left: gutterWidth };

  const innerWidth = Math.max(1, size.width - margins.left - margins.right);
  const scale = continuousScale({ domain, range: [margins.left, margins.left + innerWidth] });

  const markerLabels = markers.map((marker) => {
    const at = scale.position(marker.at);
    const text = `${marker.label} ${timeText(marker.at)}`;
    const width = text.length * CHARACTER_WIDTH + MARKER_LABEL_GAP * 2;
    const isEnd = at > margins.left + innerWidth * HALF;

    return { marker, at, text, isEnd, start: isEnd ? at - width : at, end: isEnd ? at : at + width };
  });

  const markerStacks = stackSpans(
    markerLabels.map((label) => ({ id: label.marker.id, track: 'markers', start: label.start, end: label.end })),
  );

  const markerRows = Math.max(0, ...markerLabels.map((label) => (markerStacks.get(label.marker.id)?.lane ?? 0) + 1));
  const topMargin = margins.top + markerRows * MARKER_BAND;
  const extent = ((domain[1] - domain[0]) * POINT_EXTENT) / innerWidth;
  const barExtent = ((domain[1] - domain[0]) * BAR_WIDTH_MIN) / innerWidth;

  const stacks = stackSpans(
    events.map((event) => ({
      id: event.id,
      track: event.laneId,
      start: event.end === undefined ? event.start - extent * HALF : event.start,
      end: event.end === undefined ? event.start + extent * HALF : Math.max(event.end, event.start + barExtent),
    })),
  );

  const laneRows = lanes.map((lane) =>
    Math.max(
      1,
      ...events.flatMap((event) => (event.laneId === lane.id ? [(stacks.get(event.id)?.lane ?? 0) + 1] : [])),
    ),
  );

  const rows = lanes.flatMap((lane, index) =>
    Array.from({ length: laneRows[index] ?? 1 }, (_, row) => ({ laneId: lane.id, row })),
  );

  const height = topMargin + rows.length * ROW_HEIGHT + lanes.length * LANE_PADDING * 2 + margins.bottom;
  const box = plotBox({ width: size.width, height, margins: { ...margins, top: topMargin } });

  const bands = lanes.map((lane, index) => {
    const firstRow = rows.findIndex((row) => row.laneId === lane.id);
    const start = box.top + index * LANE_PADDING * 2 + firstRow * ROW_HEIGHT;

    return { lane, index, start, end: start + (laneRows[index] ?? 1) * ROW_HEIGHT + LANE_PADDING * 2 };
  });

  const timeLabels = timeAxisTicks({ domain, length: box.innerWidth, timeFormat, locale, timeZone: zone });

  const ticks: ReadonlyArray<PlotTick> = timeLabels.values.map((tick, index) => ({
    key: String(tick),
    position: scale.position(tick),
    label: timeLabels.labels[index] ?? '',
  }));

  const laneTicks = bands.map((band) => ({
    key: band.lane.id,
    position: (band.start + band.end) * HALF,
    label: band.lane.label,
  }));

  const ordered = events
    .map((event, index) => ({ event, index }))
    .toSorted((first, second) =>
      first.event.start === second.event.start ? first.index - second.index : first.event.start - second.event.start,
    )
    .map((entry) => entry.event);

  const placed = ordered.map((event, rank) => {
    const band = bands.find((candidate) => candidate.lane.id === event.laneId);
    const laneIndex = band?.index ?? 0;
    const lane = lanes[laneIndex];
    const row = stacks.get(event.id)?.lane ?? 0;
    const y = (band?.start ?? box.top) + LANE_PADDING + (row + HALF) * ROW_HEIGHT;
    const x1 = scale.position(event.start);
    const x2 = event.end === undefined ? x1 : Math.max(x1 + BAR_WIDTH_MIN, scale.position(event.end));
    const tone = event.tone ?? tones({ id: event.laneId, tone: lane?.tone, index: laneIndex });

    return { event, rank, laneIndex, laneLabel: lane?.label ?? event.laneId, x1, x2, y, tone };
  });

  const items = placed.map(({ event, laneLabel }) => {
    const span =
      event.end === undefined
        ? timeText(event.start)
        : `${timeText(event.start)} – ${timeText(event.end)} · ${durationText(event.end - event.start, locale)}`;

    return {
      id: event.id,
      label: [laneLabel, event.label, span, event.detail].filter((part) => part !== undefined).join(' · '),
    };
  });

  const laneStep = 1 / (lanes.length * 2 + 1);

  const nearest = locateNearest({
    marks: placed.map((mark) => ({ id: mark.event.id, x: (mark.x1 + mark.x2) * HALF, y: mark.y })),
    width: box.width,
    height: box.height,
  });

  function locate(point: ChartPoint): string | undefined {
    const x = (point.x / point.width) * box.width;
    const y = (point.y / point.height) * box.height;

    const hit = placed.findLast((mark) => {
      const isAcross = x >= mark.x1 - POINT_RADIUS - HIT_SLOP && x <= mark.x2 + POINT_RADIUS + HIT_SLOP;

      return isAcross && Math.abs(y - mark.y) <= ROW_HEIGHT * HALF;
    });

    return hit?.event.id ?? nearest(point);
  }

  return (
    <Chart
      {...link}
      items={items}
      place={(id) => {
        const mark = placed.find((candidate) => candidate.event.id === id);
        const left = mark?.rank ?? 0;
        const top = (mark?.laneIndex ?? 0) * laneStep;

        return mark === undefined ? undefined : { left, right: left, top, bottom: top };
      }}
      locate={locate}
      selected={selected ?? null}
      onSelect={onSelectedChange}
      render={(figureProps, { inspected, cursor }) => {
        const cursorMark = placed.find((mark) => mark.event.id === cursor);

        return (
          <FigureFrame
            {...frame}
            actions={windowActions}
            figure={figureProps}
            footer={
              events.length === 0 ? undefined : (
                <ChartReadout id={readoutId}>{inspectedLabel(items, inspected)}</ChartReadout>
              )
            }
          >
            {events.length === 0 ? (
              <FigureEmpty>{emptyLabel}</FigureEmpty>
            ) : (
              <>
                <PlotSurface
                  plotRef={size.ref}
                  box={box}
                  label={plotLabel({ title, marks: 'events', isSelectable: onSelectedChange !== undefined })}
                  readoutId={readoutId}
                >
                  <PlotAxes box={box} xTicks={ticks} yTicks={laneTicks} xTitle={`Time (${zone})`} grid="x" />
                  {bands.slice(1).map((band) => (
                    <line
                      key={band.lane.id}
                      x1={box.left}
                      x2={box.right}
                      y1={band.start}
                      y2={band.start}
                      {...stylex.props(chartStyles.grid, styles.separator)}
                    />
                  ))}
                  <PlotClip box={box}>
                    {placed.map((mark) =>
                      mark.event.end === undefined ? (
                        <DotMark
                          key={mark.event.id}
                          x={mark.x1}
                          y={mark.y}
                          radius={POINT_RADIUS}
                          tone={mark.tone}
                          isInspected={inspected === mark.event.id}
                          isSelected={selected === mark.event.id}
                        />
                      ) : (
                        <BarMark
                          key={mark.event.id}
                          x={mark.x1}
                          y={mark.y - BAR_HEIGHT * HALF}
                          width={mark.x2 - mark.x1}
                          height={BAR_HEIGHT}
                          tone={mark.tone}
                          isInspected={inspected === mark.event.id}
                          isSelected={selected === mark.event.id}
                        />
                      ),
                    )}
                  </PlotClip>
                  {markerLabels.map(({ marker, at, text, isEnd }) => {
                    const row = markerStacks.get(marker.id)?.lane ?? 0;
                    const y = box.top - MARKER_LABEL_GAP * 2 - row * MARKER_BAND;

                    return (
                      <g key={marker.id}>
                        <RuleMark x1={at} x2={at} y1={y + MARKER_LABEL_GAP} y2={box.bottom} stroke="dashed" />
                        <LabelMark
                          x={isEnd ? at - MARKER_LABEL_GAP : at + MARKER_LABEL_GAP}
                          y={y}
                          anchor={isEnd ? 'end' : 'start'}
                        >
                          {text}
                        </LabelMark>
                      </g>
                    );
                  })}
                  {cursorMark !== undefined && (
                    <ChartCursor
                      x={(cursorMark.x1 + cursorMark.x2) * HALF}
                      top={box.top}
                      bottom={box.bottom}
                      width={CURSOR_WIDTH}
                    />
                  )}
                </PlotSurface>
                <ChartData
                  label={`${title} events`}
                  columns={[{ id: 'event', label: 'Event' }]}
                  rows={items.map((item) => ({ id: item.id, values: [item.label] }))}
                />
              </>
            )}
          </FigureFrame>
        );
      }}
    />
  );
}
