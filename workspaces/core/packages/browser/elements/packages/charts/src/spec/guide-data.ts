import { dateFormatter } from '@ui-sdk/core/date';
import { sum } from '../transforms/values.ts';

/**
 * Small closed-form data for the chart guide's examples. Each function returns plain JSON values, so an example built
 * with them is still a spec an agent could have written by hand.
 */

const HALF = 0.5;
const ROUNDING = 1000;
const PERCENT_ROUNDING = 10_000;
const DENSITY_ROUNDING = 1_000_000;
const FULL_TURN = Math.PI + Math.PI;
const isoDateFormat = { timeZone: 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' } as const;
const TILE_SIZE = 96;
const TILE_HUE_STEP = 47;
const TILE_TURN = 360;
const TILE_RADIUS = 26;
const TILE_LIGHT = 62;
const TILE_DARK = 30;

/** A number rounded to three decimals, so examples stay readable as JSON. */
export function round(value: number): number {
  return Math.round(value * ROUNDING) / ROUNDING;
}

export type RangeInput = {
  readonly count: number;
  readonly start?: number | undefined;
  readonly step?: number | undefined;
};

/** Evenly spaced numbers: `count` of them from `start`, `step` apart. */
export function range({ count, start = 0, step = 1 }: RangeInput): ReadonlyArray<number> {
  return Array.from({ length: count }, (_, index) => round(start + index * step));
}

export type DecayInput = {
  readonly xs: ReadonlyArray<number>;
  readonly start: number;
  readonly floor: number;
  /** How fast the value falls toward the floor, per unit of `log10(x / xs[0])`. */
  readonly rate: number;
  /** The half-width of a band around each value, as a share of the value. Leave it out for no band. */
  readonly spread?: number | undefined;
};

/** A loss-like curve that falls from `start` toward `floor` over log-spaced steps. */
export function decay({
  xs,
  start,
  floor,
  rate,
  spread,
}: DecayInput): ReadonlyArray<{
  readonly x: number;
  readonly y: number;
  readonly lower?: number;
  readonly upper?: number;
}> {
  const first = xs[0] ?? 1;

  return xs.map((x) => {
    const y = floor + (start - floor) * Math.exp(-rate * Math.log10(x / first));

    return spread === undefined
      ? { x, y: round(y) }
      : { x, y: round(y), lower: round(y * (1 - spread)), upper: round(y * (1 + spread)) };
  });
}

export type WaveInput = {
  readonly count: number;
  readonly base: number;
  readonly amplitude: number;
  /** Values per full cycle. */
  readonly cycle: number;
  readonly phase?: number | undefined;
  /** Added per value, for a drift. */
  readonly trend?: number | undefined;
};

/** A smooth, repeating series of values, such as daily traffic. */
export function wave({ count, base, amplitude, cycle, phase = 0, trend = 0 }: WaveInput): ReadonlyArray<number> {
  return Array.from({ length: count }, (_, index) =>
    round(base + amplitude * Math.sin(((index + phase) / cycle) * FULL_TURN) + trend * index),
  );
}

export type TimedInput = {
  readonly start: number;
  readonly step: number;
  readonly values: ReadonlyArray<number | null>;
};

/** Values at evenly spaced instants, as time series points. */
export function timed({
  start,
  step,
  values,
}: TimedInput): ReadonlyArray<{ readonly timestamp: number; readonly value: number | null }> {
  return values.map((value, index) => ({ timestamp: start + index * step, value }));
}

export type BellInput = {
  readonly center: number;
  readonly width: number;
  readonly from: number;
  readonly to: number;
  readonly count: number;
};

/** A normal density sampled at `count` evenly spaced values, for violins and ridgelines. */
export function bell({
  center,
  width,
  from,
  to,
  count,
}: BellInput): ReadonlyArray<{ readonly value: number; readonly density: number }> {
  const step = (to - from) / (count - 1);

  return Array.from({ length: count }, (_, index) => {
    const value = from + index * step;
    const score = (value - center) / width;

    return {
      value: round(value),
      density:
        Math.round((DENSITY_ROUNDING * Math.exp(-HALF * score * score)) / (width * Math.sqrt(FULL_TURN))) /
        DENSITY_ROUNDING,
    };
  });
}

export type PeaksInput = {
  readonly columns: number;
  readonly rows: number;
  /** Peaks in grid units from the top left: where each sits, how wide it is and how high. */
  readonly peaks: ReadonlyArray<{
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
  }>;
};

/** A grid of values, row by row from the top, made of smooth peaks: a loss surface or a point density. */
export function peaks({ columns, rows, peaks: list }: PeaksInput): ReadonlyArray<number> {
  return Array.from({ length: rows * columns }, (_, index) => {
    const x = index % columns;
    const y = Math.floor(index / columns);

    return round(
      sum(
        list.map((peak) => {
          const across = (x - peak.x) / peak.width;
          const down = (y - peak.y) / peak.width;

          return peak.height * Math.exp(-HALF * (across * across + down * down));
        }),
      ),
    );
  });
}

export type DaysInput = {
  /** The first day, as an instant at midnight UTC. */
  readonly start: number;
  /** The length of a day in the same unit. */
  readonly step: number;
  readonly count: number;
};

/** `count` consecutive calendar days, as `YYYY-MM-DD` strings. */
export function days({ start, step, count }: DaysInput): ReadonlyArray<string> {
  const isoDate = dateFormatter('en-CA', isoDateFormat);

  return Array.from({ length: count }, (_, index) => isoDate.format(start + index * step));
}

/** A share rounded to four decimals, so `0.1234` reads as 12.34% with a percent format. */
export function share(value: number): number {
  return Math.round(value * PERCENT_ROUNDING) / PERCENT_ROUNDING;
}

/** A small synthetic picture as a data URL: a white disc on a hue. The same index always gives the same picture. */
export function tile(index: number): string {
  const hue = (index * TILE_HUE_STEP) % TILE_TURN;
  const center = TILE_SIZE * HALF;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${TILE_SIZE} ${TILE_SIZE}"><rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="hsl(${hue} 60% ${TILE_LIGHT}%)"/><rect y="${center}" width="${TILE_SIZE}" height="${center}" fill="hsl(${hue} 55% ${TILE_DARK}%)"/><circle cx="${center}" cy="${center}" r="${TILE_RADIUS}" fill="white"/></svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
