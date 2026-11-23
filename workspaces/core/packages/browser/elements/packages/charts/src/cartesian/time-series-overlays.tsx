import type { ReactNode } from 'react';
import { areaPath, linePath } from '../plot/path.ts';
import { BandMark, GuideMark, LabelMark, LineMark, RingMark } from '../plot/plot-marks.tsx';
import type { PlotBand, TimeSeriesBandPoint } from './time-series-bands.ts';

/** An instant labelled on the plot: a supplied event marker or a found crossing, which also has a value. */
export type TimeLabelledInstant = {
  readonly id: string;
  readonly timestamp: number;
  readonly label: string;
  readonly value?: number | undefined;
};

export type PlacedInstant = TimeLabelledInstant & { readonly lane: number; readonly anchor: 'start' | 'end' };

const LANE_HEIGHT_PX = 16;
const LANES_MAX = 2;
const LABEL_GAP_PX = 6;
const CHARACTER_WIDTH_PX = 6.5;
const LABEL_BASELINE_PX = 4;

type LaneInput = {
  readonly instants: ReadonlyArray<TimeLabelledInstant>;
  readonly x: (timestamp: number) => number;
  readonly right: number;
};

/** Lays out instants in time order; `ends` holds where each lane's last label ends. */
function placeInLanes({
  instants,
  x,
  right,
  ends,
}: LaneInput & { readonly ends: ReadonlyArray<number> }): ReadonlyArray<PlacedInstant> {
  const [instant, ...rest] = instants;

  if (instant === undefined) {
    return [];
  }

  const position = x(instant.timestamp);
  const width = instant.label.length * CHARACTER_WIDTH_PX + LABEL_GAP_PX;
  const anchor = position + width > right ? 'end' : 'start';
  const start = anchor === 'start' ? position : position - width;
  const end = anchor === 'start' ? position + width : position;
  const free = ends.findIndex((laneEnd) => start > laneEnd);
  const lane = free === -1 ? Math.min(ends.length, LANES_MAX - 1) : free;
  const nextEnds = [...ends.slice(0, lane), Math.max(end, ends[lane] ?? end), ...ends.slice(lane + 1)];
  const placed: PlacedInstant = { ...instant, lane, anchor };

  return [placed, ...placeInLanes({ instants: rest, x, right, ends: nextEnds })];
}

/** Places each label beside its guide in the first lane where it fits, flipping before the plot's right edge. */
export function placeInstants({ instants, x, right }: LaneInput): ReadonlyArray<PlacedInstant> {
  const ordered = instants.toSorted((first, second) => first.timestamp - second.timestamp);

  return placeInLanes({ instants: ordered, x, right, ends: [] });
}

/** The room the instants' label lanes take above the plot. */
export function instantsInset(placed: ReadonlyArray<PlacedInstant>): number {
  const lanes = Math.max(0, ...placed.map((instant) => instant.lane + 1));

  return lanes * LANE_HEIGHT_PX;
}

type Scales = { readonly x: (timestamp: number) => number; readonly y: (value: number) => number };

/** Shades each band between its bounds and draws its center line over the shade. */
export function TimeSeriesBands({ bands, x, y }: Scales & { readonly bands: ReadonlyArray<PlotBand> }): ReactNode {
  return (
    <g>
      {bands.map((band) => {
        function edge(value: (point: TimeSeriesBandPoint) => number | null): ReadonlyArray<number | null> {
          return band.points.map((point) => {
            const level = value(point);

            return level === null ? null : y(level);
          });
        }

        const lower = edge((point) => point.lower);
        const upper = edge((point) => point.upper);
        const center = edge((point) => point.center);
        const xs = band.points.map((point) => x(point.timestamp));

        return (
          <g key={band.id}>
            <BandMark
              d={areaPath(
                xs.map((position, index) => ({ x: position, y0: lower[index] ?? null, y1: upper[index] ?? null })),
              )}
              tone={band.tone}
            />
            <LineMark
              d={linePath(xs.map((position, index) => ({ x: position, y: center[index] ?? null })))}
              tone={band.tone}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Draws each instant's guide from its label lane above the plot to the axis, with a ring where a crossing lands. */
export function TimeInstants({
  placed,
  x,
  y,
  top,
  bottom,
}: Scales & {
  readonly placed: ReadonlyArray<PlacedInstant>;
  readonly top: number;
  readonly bottom: number;
}): ReactNode {
  const laneTop = top - instantsInset(placed);

  return (
    <g aria-hidden>
      {placed.map((instant) => {
        const position = x(instant.timestamp);
        const laneY = laneTop + (instant.lane + 1 / 2) * LANE_HEIGHT_PX;
        const textX = instant.anchor === 'start' ? position + LABEL_GAP_PX : position - LABEL_GAP_PX;

        return (
          <g key={instant.id}>
            <GuideMark x={position} top={laneY} bottom={bottom} />
            <LabelMark x={textX} y={laneY + LABEL_BASELINE_PX} anchor={instant.anchor}>
              {instant.label}
            </LabelMark>
            {instant.value !== undefined && <RingMark x={position} y={y(instant.value)} />}
          </g>
        );
      })}
    </g>
  );
}
