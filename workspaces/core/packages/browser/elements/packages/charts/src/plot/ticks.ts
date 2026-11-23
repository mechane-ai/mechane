import type { NumericDomain, ScaleType } from './scale.ts';

const DECADE = 10;
const HALF_DECADE = 5;
const DOUBLE = 2;
const TICKS_MAX = 200;
const LOG_POWERS_ENOUGH = 3;

/** A raw step rounds up to 10, 5 or 2 once it passes the geometric mean of that factor and the one below it. */
const TEN_STEP_ERROR = Math.sqrt(DECADE * HALF_DECADE);
const FIVE_STEP_ERROR = Math.sqrt(HALF_DECADE * DOUBLE);
const TWO_STEP_ERROR = Math.sqrt(DOUBLE);
const logMultiples = [1, DOUBLE, HALF_DECADE] as const;

function stepFactor(error: number): number {
  if (error >= TEN_STEP_ERROR) {
    return DECADE;
  }

  if (error >= FIVE_STEP_ERROR) {
    return HALF_DECADE;
  }

  return error >= TWO_STEP_ERROR ? DOUBLE : 1;
}

/**
 * Round values between two bounds, about `count` of them, on steps of 1, 2 or 5 times a power of ten. The bounds
 * themselves appear only when they are round.
 */
export function linearTicks(domain: NumericDomain, count: number): ReadonlyArray<number> {
  const [start, stop] = domain;

  if (!(count > 0) || !(stop > start)) {
    return [];
  }

  const rawStep = (stop - start) / count;
  const power = Math.floor(Math.log10(rawStep));
  const factor = stepFactor(rawStep / DECADE ** power);

  // A step below one is kept as its inverse, so 0.1 steps count in whole numbers and print without float noise.
  const isFraction = power < 0;
  const unit = isFraction ? DECADE ** -power / factor : DECADE ** power * factor;
  const startIndex = isFraction ? start * unit : start / unit;
  const stopIndex = isFraction ? stop * unit : stop / unit;
  const first = Math.ceil(startIndex - Number.EPSILON * Math.abs(startIndex));
  const last = Math.floor(stopIndex + Number.EPSILON * Math.abs(stopIndex));
  const length = Math.max(0, Math.min(TICKS_MAX, last - first + 1));

  return Array.from({ length }, (_, index) => (isFraction ? (first + index) / unit : (first + index) * unit));
}

/**
 * The powers of ten inside a positive domain, about `count` of them. A domain that holds fewer than three powers also
 * gets their 2 and 5 multiples, so a short log axis still shows enough ticks to read.
 */
export function logTicks(domain: NumericDomain, count: number): ReadonlyArray<number> {
  const [start, stop] = domain;

  if (!(start > 0) || !(stop > start)) {
    return [];
  }

  const firstPower = Math.floor(Math.log10(start));
  const lastPower = Math.ceil(Math.log10(stop));
  const powers = Array.from({ length: lastPower - firstPower + 1 }, (_, index) => firstPower + index);
  const inside = powers.filter((power) => DECADE ** power >= start && DECADE ** power <= stop);

  if (inside.length >= Math.min(count, LOG_POWERS_ENOUGH)) {
    const stride = Math.max(1, Math.ceil(inside.length / Math.max(1, count)));

    return inside.filter((_, index) => index % stride === 0).map((power) => DECADE ** power);
  }

  return powers
    .flatMap((power) => logMultiples.map((multiple) => multiple * DECADE ** power))
    .filter((tick) => tick >= start && tick <= stop);
}

/** Zero and the powers of ten on each side of it that a signed domain holds. */
export function symlogTicks(domain: NumericDomain, count: number): ReadonlyArray<number> {
  const [start, stop] = domain;
  const perSide = Math.max(1, Math.floor(count / DOUBLE));
  const positive = stop > 1 ? logTicks([1, stop], perSide).filter((tick) => Number.isInteger(Math.log10(tick))) : [];

  const negative =
    start < -1 ? logTicks([1, -start], perSide).filter((tick) => Number.isInteger(Math.log10(tick))) : [];

  return [...negative.map((tick) => -tick).toReversed(), ...(start <= 0 && stop >= 0 ? [0] : []), ...positive].filter(
    (tick) => tick >= start && tick <= stop,
  );
}

export type TickInput = {
  readonly domain: NumericDomain;
  readonly type?: ScaleType | undefined;
  /** About how many ticks to return. The round steps decide the exact number. */
  readonly count: number;
};

/** Tick values for a measured axis of any scale type. */
export function scaleTicks({ domain, type = 'linear', count }: TickInput): ReadonlyArray<number> {
  if (type === 'log') {
    return logTicks(domain, count);
  }

  return type === 'symlog' ? symlogTicks(domain, count) : linearTicks(domain, count);
}

const MILLISECONDS_PER_SECOND = 1000;

/** The round clock steps an axis may use, in seconds and in increasing length. */
const stepSeconds = {
  second: 1,
  fiveSeconds: 5,
  quarterMinute: 15,
  halfMinute: 30,
  minute: 60,
  fiveMinutes: 300,
  quarterHour: 900,
  halfHour: 1800,
  hour: 3600,
  threeHourly: 10_800,
  sixHourly: 21_600,
  halfDay: 43_200,
  day: 86_400,
  twoDays: 172_800,
  week: 604_800,
  month: 2_592_000,
  quarter: 7_776_000,
  year: 31_536_000,
  twoYears: 63_072_000,
  fiveYears: 157_680_000,
  decade: 315_360_000,
} as const;

const DAY = stepSeconds.day * MILLISECONDS_PER_SECOND;
const WEEK = stepSeconds.week * MILLISECONDS_PER_SECOND;

export type TimeTickInput = {
  /** The first and last instant, in milliseconds since the epoch. */
  readonly domain: NumericDomain;
  readonly count: number;
  /** How far the reader's time zone is ahead of UTC at the domain's start, in milliseconds. */
  readonly zoneOffset: number;
};

/**
 * Instants on round clock steps in the reader's zone: seconds, minutes, hours or days. Spans of months and years fall
 * on multiples of 30, 90 or 365 days from the first local midnight, which a date format labels by its day. Spans of
 * decades step by two, five or ten such years.
 */
export function timeTicks({ domain, count, zoneOffset }: TimeTickInput): ReadonlyArray<number> {
  const [start, stop] = domain;

  if (!(count > 0) || !(stop > start)) {
    return [];
  }

  const ideal = (stop - start) / count;
  const steps = Object.values(stepSeconds).map((seconds) => seconds * MILLISECONDS_PER_SECOND);
  const step = steps.find((candidate) => candidate >= ideal) ?? stepSeconds.year * MILLISECONDS_PER_SECOND;
  const origin = step > WEEK ? Math.ceil((start + zoneOffset) / DAY) * DAY : 0;
  const first = origin + Math.ceil((start + zoneOffset - origin) / step) * step;
  const length = Math.max(0, Math.min(TICKS_MAX, Math.floor((stop + zoneOffset - first) / step) + 1));

  return Array.from({ length }, (_, index) => first + index * step - zoneOffset);
}
