import { distinctSorted, invalid, mean, noteNumber, observedPoints, sum } from './values.ts';
import type { ObservedPoint, SeriesPoint, TransformOk, TransformResult } from './values.ts';

const FIT_POINTS_MIN = 2;

type LeastSquares = {
  readonly slope: number;
  readonly intercept: number;
  /** The share of the variation in y the line explains; null when y does not vary. */
  readonly rSquared: number | null;
};

/** The straight line through points that makes the squared vertical distances smallest, or why there is none. */
function leastSquares(points: ReadonlyArray<ObservedPoint>): LeastSquares | string {
  if (points.length < FIT_POINTS_MIN) {
    return 'A fit needs at least two points with values.';
  }

  const xMean = mean(points.map((point) => point.x));
  const yMean = mean(points.map((point) => point.y));
  const xSpread = sum(points.map((point) => (point.x - xMean) * (point.x - xMean)));

  if (xSpread === 0) {
    return 'A fit needs points at two or more different x values.';
  }

  const slope = sum(points.map((point) => (point.x - xMean) * (point.y - yMean))) / xSpread;
  const intercept = yMean - slope * xMean;
  const total = sum(points.map((point) => (point.y - yMean) * (point.y - yMean)));

  const residual = sum(
    points.map((point) => {
      const error = point.y - (intercept + slope * point.x);

      return error * error;
    }),
  );

  return { slope, intercept, rSquared: total === 0 ? null : 1 - residual / total };
}

export type LinearFitResult = TransformResult<
  LeastSquares & {
    /** The line at each distinct observed x, from smallest to largest: a series a chart can draw dashed. */
    readonly fitted: ReadonlyArray<ObservedPoint>;
    /** How many points the fit used. */
    readonly count: number;
    /** Points with a missing x or y. */
    readonly skipped: number;
  }
>;

/**
 * The straight line y = slope × x + intercept that minimizes the sum of squared vertical distances from the points to
 * the line, by ordinary least squares. The r² value is the share of the variation in y that the line explains (1 is a
 * perfect fit). Points with a missing x or y are skipped and counted.
 */
export function linearFit(points: ReadonlyArray<SeriesPoint>): LinearFitResult {
  const used = observedPoints(points);
  const fit = leastSquares(used);

  if (typeof fit === 'string') {
    return invalid(fit);
  }

  return {
    kind: 'ok',
    ...fit,
    fitted: distinctSorted(used.map((point) => point.x)).map((x) => ({ x, y: fit.intercept + fit.slope * x })),
    count: used.length,
    skipped: points.length - used.length,
  };
}

function rSquaredNote(rSquared: number | null, locale: string): string {
  return rSquared === null ? '' : `, r² ${noteNumber(rSquared, locale)}`;
}

/** The footnote for `linearFit`, as in "Least-squares line, slope 0.42, r² 0.97." */
export function describeLinearFit({
  result,
  locale,
}: {
  readonly result: TransformOk<LinearFitResult>;
  readonly locale: string;
}): string {
  return `Least-squares line, slope ${noteNumber(result.slope, locale)}${rSquaredNote(result.rSquared, locale)}.`;
}

export type PowerLawFitResult = TransformResult<{
  readonly exponent: number;
  readonly coefficient: number;
  /** r² of the straight-line fit in log-log space. */
  readonly rSquared: number | null;
  /** The curve at each distinct observed x, from smallest to largest. */
  readonly fitted: ReadonlyArray<ObservedPoint>;
  readonly count: number;
  /** Points with a missing x or y. */
  readonly skipped: number;
}>;

/**
 * The power law y = coefficient × x^exponent that best follows the points, as in scaling-law plots. Taking logarithms
 * turns it into the line log y = log coefficient + exponent × log x, fitted by least squares, with r² of that line in
 * log-log space. Logarithms need positive numbers, so any x or y at or below zero is rejected, and points with a
 * missing x or y are skipped and counted.
 */
export function powerLawFit(points: ReadonlyArray<SeriesPoint>): PowerLawFitResult {
  const used = observedPoints(points);
  const nonPositive = used.find((point) => point.x <= 0 || point.y <= 0);

  if (nonPositive !== undefined) {
    return invalid(`A power-law fit needs positive x and y; the point at x = ${nonPositive.x} is not.`);
  }

  const fit = leastSquares(used.map((point) => ({ x: Math.log(point.x), y: Math.log(point.y) })));

  if (typeof fit === 'string') {
    return invalid(fit);
  }

  const coefficient = Math.exp(fit.intercept);

  return {
    kind: 'ok',
    exponent: fit.slope,
    coefficient,
    rSquared: fit.rSquared,
    fitted: distinctSorted(used.map((point) => point.x)).map((x) => ({ x, y: coefficient * x ** fit.slope })),
    count: used.length,
    skipped: points.length - used.length,
  };
}

/** The footnote for `powerLawFit`, as in "Power-law fit by least squares in log-log space, exponent −0.11." */
export function describePowerLawFit({
  result,
  locale,
}: {
  readonly result: TransformOk<PowerLawFitResult>;
  readonly locale: string;
}): string {
  return `Power-law fit by least squares in log-log space, exponent ${noteNumber(result.exponent, locale)}${rSquaredNote(result.rSquared, locale)}.`;
}
