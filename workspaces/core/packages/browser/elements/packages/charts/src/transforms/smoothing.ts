import { finiteOrNull, invalid, mean, noteNumber, observedValues, scan } from './values.ts';
import type { SeriesPoint, TransformOk, TransformResult } from './values.ts';

export type MovingAverageResult = TransformResult<{
  readonly points: ReadonlyArray<SeriesPoint>;
  /** How many points each mean spans. */
  readonly size: number;
}>;

export type ExponentialSmoothingResult = TransformResult<{
  readonly points: ReadonlyArray<SeriesPoint>;
  readonly weight: number;
}>;

/**
 * A trailing moving average: each point becomes the mean of the observed values among itself and the `size − 1` points
 * before it. The first points average over fewer values, and a missing point (null, NaN or infinite) stays missing. It
 * is not counted in its neighbours' means, so gaps in the line are kept.
 */
export function movingAverage({
  points,
  size,
}: {
  readonly points: ReadonlyArray<SeriesPoint>;
  /** How many points each mean spans, the point itself included. */
  readonly size: number;
}): MovingAverageResult {
  if (!(Number.isInteger(size) && size >= 1)) {
    return invalid('The window size must be a whole number of at least 1 point.');
  }

  return {
    kind: 'ok',
    points: points.map((point, index) => {
      const recent = observedValues(points.slice(Math.max(0, index - size + 1), index + 1).map((near) => near.y));

      return { x: point.x, y: finiteOrNull(point.y) === null ? null : mean(recent) };
    }),
    size,
  };
}

/** The footnote for `movingAverage`, as in "Trailing mean over 10 points." */
export function describeMovingAverage({
  result,
  locale,
}: {
  readonly result: TransformOk<MovingAverageResult>;
  readonly locale: string;
}): string {
  return `Trailing mean over ${noteNumber(result.size, locale)} points.`;
}

type SmoothingState = {
  /** The running weighted total, before the start-up correction. */
  readonly total: number;
  /** How many observed values the total has seen. */
  readonly observed: number;
  readonly y: number | null;
};

/**
 * The exponential moving average that training dashboards draw over a noisy loss: each smoothed value is `weight` times
 * the previous one plus `1 − weight` times the new value. Because the average starts from zero, each value is then
 * divided by 1 − weight^n (n = values seen so far), the debiased form TensorBoard uses. That removes the pull toward
 * zero at the start, and a missing point stays missing and does not move the average.
 */
export function exponentialSmoothing({
  points,
  weight,
}: {
  readonly points: ReadonlyArray<SeriesPoint>;
  /** How much of the previous average each step keeps, from 0 (no smoothing) up to but not including 1. */
  readonly weight: number;
}): ExponentialSmoothingResult {
  if (!(weight >= 0 && weight < 1)) {
    return invalid('The smoothing weight must be at least 0 and below 1.');
  }

  const states = scan<SeriesPoint, SmoothingState>({
    items: points,
    initial: { total: 0, observed: 0, y: null },
    step: (state, point) => {
      const value = finiteOrNull(point.y);

      if (value === null) {
        return { ...state, y: null };
      }

      const total = state.total * weight + (1 - weight) * value;
      const observed = state.observed + 1;

      return { total, observed, y: total / (1 - weight ** observed) };
    },
  });

  return { kind: 'ok', points: points.map((point, index) => ({ x: point.x, y: states[index]?.y ?? null })), weight };
}

/** The footnote for `exponentialSmoothing`, as in "Exponential moving average, weight 0.9, debiased." */
export function describeExponentialSmoothing({
  result,
  locale,
}: {
  readonly result: TransformOk<ExponentialSmoothingResult>;
  readonly locale: string;
}): string {
  return `Exponential moving average, weight ${noteNumber(result.weight, locale)}, debiased.`;
}
