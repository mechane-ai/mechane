import type { FigureCoverage } from '../figure/figure-props.ts';
import { finiteOrNull, invalid, mean, noteNumber, observedPoints, scan } from './values.ts';
import type { ObservedPoint, SeriesPoint, TransformOk, TransformResult } from './values.ts';

const LTTB_TARGET_MIN = 3;
const ENDPOINTS = 2;
const LEHMER_MODULUS = 2_147_483_647;
const LEHMER_MULTIPLIER = 48_271;

/** A sample of a long list: the indices kept, in increasing order, and the figure coverage that states the share. */
export type SampleResult = TransformResult<{
  readonly indices: ReadonlyArray<number>;
  readonly coverage: FigureCoverage;
  /** The seed of a random sample; null for an even one. */
  readonly seed: number | null;
}>;

export type DownsampleResult = TransformResult<{
  readonly points: ReadonlyArray<SeriesPoint>;
  readonly coverage: FigureCoverage;
}>;

type Segment = { readonly start: number; readonly end: number; readonly isGap: boolean };

/** Runs of consecutive observed points and of consecutive gaps. */
function segments(points: ReadonlyArray<SeriesPoint>): ReadonlyArray<Segment> {
  const isGap = points.map((point) => finiteOrNull(point.y) === null);
  const starts = isGap.flatMap((gap, index) => (index === 0 || gap !== isGap[index - 1] ? [index] : []));

  return starts.map((start, index) => ({
    start,
    end: starts[index + 1] ?? points.length,
    isGap: isGap[start] ?? false,
  }));
}

/** Twice the area of the triangle three points make. */
function triangleArea(first: ObservedPoint, second: ObservedPoint, third: ObservedPoint): number {
  return Math.abs((first.x - third.x) * (second.y - first.y) - (first.x - second.x) * (third.y - first.y));
}

/** The indices largest-triangle-three-buckets keeps from a run of observed points. */
function largestTriangles(run: ReadonlyArray<ObservedPoint>, threshold: number): ReadonlyArray<number> {
  const bucket = (run.length - ENDPOINTS) / (threshold - ENDPOINTS);

  function bucketStart(index: number): number {
    return Math.floor(index * bucket) + 1;
  }

  const chosen = scan({
    items: Array.from({ length: threshold - ENDPOINTS }, (_, index) => index),
    initial: 0,
    step: (previous, index) => {
      const next = run.slice(bucketStart(index + 1), Math.min(bucketStart(index + ENDPOINTS), run.length));
      const average = { x: mean(next.map((point) => point.x)), y: mean(next.map((point) => point.y)) };
      const anchor = run[previous] ?? average;

      const areas = run
        .slice(bucketStart(index), bucketStart(index + 1))
        .map((point) => triangleArea(anchor, point, average));

      const best = scan({
        items: areas,
        initial: 0,
        step: (top, area, position) => (area > (areas[top] ?? area) ? position : top),
      });

      return bucketStart(index) + (best.at(-1) ?? 0);
    },
  });

  return [0, ...chosen, run.length - 1];
}

/**
 * Thin a long series to about `target` points before drawing it, with largest-triangle-three-buckets (Steinarsson,
 * 2013), so peaks, dips and the first and last points survive. The points are split into equal buckets, and each bucket
 * keeps the point that makes the largest triangle with its chosen neighbours. Gaps are kept: each run of missing points
 * stays as one missing point, and the budget is shared among the runs between gaps by their length.
 */
export function downsample({
  points,
  target,
  unit = 'points',
}: {
  /** The series in order of x, which must not decrease. */
  readonly points: ReadonlyArray<SeriesPoint>;
  /** About how many points to keep; at least 3. */
  readonly target: number;
  /** What the coverage counts, in the plural. Defaults to "points". */
  readonly unit?: string | undefined;
}): DownsampleResult {
  if (!(Number.isInteger(target) && target >= LTTB_TARGET_MIN)) {
    return invalid(`The target must be a whole number of at least ${LTTB_TARGET_MIN} points.`);
  }

  if (points.some((point, index) => !Number.isFinite(point.x) || point.x < (points[index - 1]?.x ?? point.x))) {
    return invalid('Every x must be a finite number, and no x may be below the one before it.');
  }

  if (points.length <= target) {
    return {
      kind: 'ok',
      points: points.map((point) => ({ x: point.x, y: finiteOrNull(point.y) })),
      coverage: { shown: points.length, total: points.length, unit },
    };
  }

  const parts = segments(points);
  const observedCount = points.filter((point) => finiteOrNull(point.y) !== null).length;
  const budget = Math.max(0, target - parts.filter((part) => part.isGap).length);

  const kept = parts.flatMap((part): ReadonlyArray<SeriesPoint> => {
    const first = points[part.start];

    if (part.isGap) {
      return first === undefined ? [] : [{ x: first.x, y: null }];
    }

    const run = observedPoints(points.slice(part.start, part.end));
    const share = Math.min(run.length, Math.max(ENDPOINTS, Math.round((budget * run.length) / observedCount)));

    if (share >= run.length) {
      return run;
    }

    const indices = share < LTTB_TARGET_MIN ? [0, run.length - 1] : largestTriangles(run, share);

    return indices.flatMap((index) => run.slice(index, index + 1));
  });

  return { kind: 'ok', points: kept, coverage: { shown: kept.length, total: points.length, unit } };
}

/** The coverage sentence of a sample: how many of how many, and how they were chosen. */
function coverageNote({
  coverage,
  locale,
  method,
}: {
  readonly coverage: FigureCoverage;
  readonly locale: string;
  readonly method: string;
}): string {
  const shown = noteNumber(coverage.shown, locale);
  const total = noteNumber(coverage.total, locale);

  return coverage.shown === coverage.total
    ? `All ${total} ${coverage.unit} shown.`
    : `${shown} of ${total} ${coverage.unit} shown (${method}).`;
}

/** The footnote for `downsample`, as in "1,000 of 50,000 points shown (largest triangle three buckets)." */
export function describeDownsample({
  result,
  locale,
}: {
  readonly result: TransformOk<DownsampleResult>;
  readonly locale: string;
}): string {
  return coverageNote({ coverage: result.coverage, locale, method: 'largest triangle three buckets' });
}

/**
 * The footnote for `sampleEvenly` and `reservoirIndices`, as in "2,000 of 80,000 points shown (evenly spaced)." or
 * "2,000 of 80,000 points shown (random sample, seed 7)."
 */
export function describeSample({
  result,
  locale,
}: {
  readonly result: TransformOk<SampleResult>;
  readonly locale: string;
}): string {
  const method = result.seed === null ? 'evenly spaced' : `random sample, seed ${result.seed}`;

  return coverageNote({ coverage: result.coverage, locale, method });
}

function countError(count: number, target: number): string | undefined {
  if (!(Number.isInteger(count) && count >= 0)) {
    return 'The count must be a whole number of at least 0.';
  }

  return Number.isInteger(target) && target >= 1 ? undefined : 'The target must be a whole number of at least 1.';
}

/**
 * Choose about `target` of `count` indices spread evenly from the first to the last, for drawing a sample of a large
 * point set. Index i of the sample is round(i × (count − 1) / (target − 1)), so the first and last are always kept.
 * Draw `points[index]` for each index and pass `coverage` to the figure.
 */
export function sampleEvenly({
  count,
  target,
  unit = 'points',
}: {
  /** How many items the full set has. */
  readonly count: number;
  readonly target: number;
  /** What the coverage counts, in the plural. Defaults to "points". */
  readonly unit?: string | undefined;
}): SampleResult {
  const error = countError(count, target);

  if (error !== undefined) {
    return invalid(error);
  }

  const shown = Math.min(count, target);

  const indices =
    shown === count
      ? Array.from({ length: count }, (_, index) => index)
      : Array.from({ length: shown }, (_, index) =>
          shown === 1 ? 0 : Math.round((index * (count - 1)) / (shown - 1)),
        );

  return { kind: 'ok', indices, coverage: { shown, total: count, unit }, seed: null };
}

/**
 * `count` pseudo-random numbers between 0 and 1 from the "minimal standard" Lehmer generator (Park and Miller, with
 * multiplier 48271): each number is the previous one times 48271, modulo 2³¹ − 1. It is small and plain arithmetic, so
 * the same seed always gives the same numbers on every machine, and a longer sequence starts with the shorter one.
 */
export function seededUniforms({
  seed,
  count,
}: {
  readonly seed: number;
  readonly count: number;
}): ReadonlyArray<number> {
  const start = ((seed % LEHMER_MODULUS) + LEHMER_MODULUS) % LEHMER_MODULUS;

  const states = scan({
    items: Array.from({ length: count }, (_, index) => index),
    initial: start === 0 ? 1 : start,
    step: (state) => (state * LEHMER_MULTIPLIER) % LEHMER_MODULUS,
  });

  return states.map((state) => state / LEHMER_MODULUS);
}

/**
 * Choose `target` of `count` indices at random, each equally likely, and the same ones every time for the same seed.
 * Index i gets the i-th number of `seededUniforms` as its key, and the indices with the `target` smallest keys are kept
 * (random-key reservoir sampling), returned in increasing order. Growing `count` keeps an earlier sample's indices
 * unless a new key undercuts them.
 */
export function reservoirIndices({
  count,
  target,
  seed,
  unit = 'points',
}: {
  readonly count: number;
  readonly target: number;
  /** Any whole number. The same seed gives the same sample. */
  readonly seed: number;
  /** What the coverage counts, in the plural. Defaults to "points". */
  readonly unit?: string | undefined;
}): SampleResult {
  const error = countError(count, target) ?? (Number.isInteger(seed) ? undefined : 'The seed must be a whole number.');

  if (error !== undefined) {
    return invalid(error);
  }

  const indices = seededUniforms({ seed, count })
    .map((key, index) => ({ index, key }))
    .toSorted((left, right) => (left.key === right.key ? left.index - right.index : left.key - right.key))
    .slice(0, target)
    .map((entry) => entry.index)
    .toSorted((left, right) => left - right);

  return { kind: 'ok', indices, coverage: { shown: indices.length, total: count, unit }, seed };
}
