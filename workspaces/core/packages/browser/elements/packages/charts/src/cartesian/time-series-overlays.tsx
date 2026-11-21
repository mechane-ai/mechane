import * as stylex from '@stylexjs/stylex';
import { Area, LinePath } from '@visx/shape';
import type { ReactNode } from 'react';
import { chartToneColors } from '../../../foundations/src/chart-tones.ts';
import { colors } from '../../../foundations/src/tokens.stylex.ts';
import { chartStyles } from '../chart-theme.ts';
import type { PlotBand, TimeSeriesBandPoint } from './time-series-bands.ts';

/** An instant labelled on the plot: a supplied event marker or a found crossing, which also has a value. */
export type TimeLabelledInstant = {
  readonly id: string;
  readonly timestamp: number;
  readonly label: string;
  readonly value?: number | undefined;
};

export type PlacedInstant = TimeLabelledInstant & { readonly lane: number; readonly anchor: 'start' | 'end' };

const styles = stylex.create({
  bandEdge: (color: string) => ({ stroke: color, strokeOpacity: 0.45, strokeWidth: 1, fill: 'none' }),
  bandFill: (color: string) => ({ fill: color, fillOpacity: 0.16 }),
  center: (color: string) => ({ stroke: color, strokeWidth: 2, fill: 'none', vectorEffect: 'non-scaling-stroke' }),
  guide: { stroke: colors.muted, strokeWidth: 1, strokeDasharray: '2 3', vectorEffect: 'non-scaling-stroke' },
  ring: { fill: colors.surface, stroke: colors.ink, strokeWidth: 2, vectorEffect: 'non-scaling-stroke' },
  flag: { fill: colors.ink },
});

const LANE_HEIGHT_PX = 16;
const LANES_MAX = 2;
const LABEL_GAP_PX = 6;
const CHARACTER_WIDTH_PX = 6.5;
const FLAG_RADIUS_PX = 2.5;
const RING_RADIUS_PX = 4;

const PLOT_TOP_PX = 12;

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

export function instantsTop(placed: ReadonlyArray<PlacedInstant>): number {
  const lanes = Math.max(0, ...placed.map((instant) => instant.lane + 1));

  return PLOT_TOP_PX + lanes * LANE_HEIGHT_PX;
}

type Scales = { readonly x: (timestamp: number) => number; readonly y: (value: number) => number };

function isBounded(point: TimeSeriesBandPoint): boolean {
  return point.lower !== null && point.upper !== null;
}

/** Shades each band between its bounds, outlines the bounds faintly, and draws its center line over the shade. */
export function TimeSeriesBands({ bands, x, y }: Scales & { readonly bands: ReadonlyArray<PlotBand> }): ReactNode {
  return (
    <g>
      {bands.map((band) => {
        const color = chartToneColors[band.tone];
        const points = [...band.points];

        return (
          <g key={band.id}>
            <Area<TimeSeriesBandPoint>
              data={points}
              defined={isBounded}
              x={(point) => x(point.timestamp)}
              y0={(point) => y(point.lower ?? 0)}
              y1={(point) => y(point.upper ?? 0)}
              {...stylex.props(styles.bandFill(color))}
            />
            <LinePath<TimeSeriesBandPoint>
              data={points}
              defined={isBounded}
              x={(point) => x(point.timestamp)}
              y={(point) => y(point.upper ?? 0)}
              {...stylex.props(styles.bandEdge(color))}
            />
            <LinePath<TimeSeriesBandPoint>
              data={points}
              defined={isBounded}
              x={(point) => x(point.timestamp)}
              y={(point) => y(point.lower ?? 0)}
              {...stylex.props(styles.bandEdge(color))}
            />
            <LinePath<TimeSeriesBandPoint>
              data={points}
              defined={(point) => point.center !== null}
              x={(point) => x(point.timestamp)}
              y={(point) => y(point.center ?? 0)}
              {...stylex.props(styles.center(color))}
            />
          </g>
        );
      })}
    </g>
  );
}

/** Draws each instant's guide from its label lane to the axis, with a ring where a crossing lands. */
export function TimeInstants({
  placed,
  x,
  y,
  bottom,
}: Scales & { readonly placed: ReadonlyArray<PlacedInstant>; readonly bottom: number }): ReactNode {
  return (
    <g aria-hidden>
      {placed.map((instant) => {
        const position = x(instant.timestamp);
        const laneY = PLOT_TOP_PX + instant.lane * LANE_HEIGHT_PX;
        const textX = instant.anchor === 'start' ? position + LABEL_GAP_PX : position - LABEL_GAP_PX;

        return (
          <g key={instant.id}>
            <line x1={position} x2={position} y1={laneY} y2={bottom} {...stylex.props(styles.guide)} />
            <circle cx={position} cy={laneY} r={FLAG_RADIUS_PX} {...stylex.props(styles.flag)} />
            <text
              x={textX}
              y={laneY}
              textAnchor={instant.anchor}
              dominantBaseline="middle"
              {...stylex.props(chartStyles.label, chartStyles.strongLabel, chartStyles.haloLabel)}
            >
              {instant.label}
            </text>
            {instant.value !== undefined && (
              <circle cx={position} cy={y(instant.value)} r={RING_RADIUS_PX} {...stylex.props(styles.ring)} />
            )}
          </g>
        );
      })}
    </g>
  );
}
