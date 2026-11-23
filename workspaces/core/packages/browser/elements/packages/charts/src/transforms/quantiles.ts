import { invalid, leftOutNote, noteNumber, sortedValues } from './values.ts';
import type { TransformOk, TransformResult } from './values.ts';

const MEDIAN = 0.5;
const LOWER_QUARTILE = 0.25;
const UPPER_QUARTILE = 0.75;
const TUKEY_FENCE = 1.5;

/** The value a fraction `p` of the way through values already sorted from smallest to largest (type 7). */
export function sortedQuantile(sorted: ReadonlyArray<number>, probability: number): number | null {
  if (sorted.length === 0 || !(probability >= 0 && probability <= 1)) {
    return null;
  }

  const position = (sorted.length - 1) * probability;
  const below = sorted[Math.floor(position)];
  const above = sorted[Math.ceil(position)];

  if (below === undefined || above === undefined) {
    return null;
  }

  return below + (position - Math.floor(position)) * (above - below);
}

/**
 * The quantile of Hyndman and Fan type 7, the default of R, NumPy and spreadsheets: the value below which a fraction
 * `p` of the values lie. The median is `quantile(values, 0.5)`, read from the sorted values at position (n − 1) × p by
 * linear interpolation between the two nearest, and missing values are skipped. It returns null when no values remain
 * or `p` is outside 0 to 1, and a footnote may name it "90th percentile (linear interpolation)."
 */
export function quantile(values: ReadonlyArray<number | null>, probability: number): number | null {
  return sortedQuantile(sortedValues(values), probability);
}

/** The smallest value, the quartiles, the median and the largest value of a set. */
export type FiveNumberSummary = {
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
  /** How many values the summary describes. */
  readonly count: number;
};

export type FiveNumberResult = TransformResult<{
  readonly summary: FiveNumberSummary;
  /** Values that were missing (null, NaN or infinite). */
  readonly skipped: number;
}>;

/**
 * The five numbers that outline a distribution: smallest, lower quartile, median, upper quartile and largest. The
 * quartiles use the same linear interpolation as `quantile` (type 7), and missing values are skipped and counted. Name
 * it in `transforms` as: "Quartiles by linear interpolation."
 */
export function fiveNumberSummary(values: ReadonlyArray<number | null>): FiveNumberResult {
  const sorted = sortedValues(values);
  const q1 = sortedQuantile(sorted, LOWER_QUARTILE);
  const median = sortedQuantile(sorted, MEDIAN);
  const q3 = sortedQuantile(sorted, UPPER_QUARTILE);
  const min = sorted[0];
  const max = sorted.at(-1);

  const hasQuartiles = q1 !== null && median !== null && q3 !== null;
  const hasExtremes = min !== undefined && max !== undefined;

  if (!hasQuartiles || !hasExtremes) {
    return invalid('There are no values to summarize.');
  }

  return {
    kind: 'ok',
    summary: { min, q1, median, q3, max, count: sorted.length },
    skipped: values.length - sorted.length,
  };
}

/** How far a box plot's whiskers reach. */
export type WhiskerRule = 'tukey' | 'range';

/** What a box plot draws for one group. */
export type BoxSummary = {
  /** The end of the lower whisker. */
  readonly low: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  /** The end of the upper whisker. */
  readonly high: number;
  /** The values beyond the whiskers, from smallest to largest. */
  readonly outliers: ReadonlyArray<number>;
  readonly count: number;
};

export type BoxSummaryResult = TransformResult<{
  readonly summary: BoxSummary;
  readonly whisker: WhiskerRule;
  /** Values that were missing (null, NaN or infinite). */
  readonly skipped: number;
}>;

/**
 * The box, whiskers and outliers of a box plot, where the box spans the lower to the upper quartile with a line at the
 * median (linear interpolation, type 7). With `whisker: 'tukey'` (Tukey's rule) each whisker reaches the furthest value
 * within 1.5 box lengths of the box, and values beyond are outliers. With `'range'` the whiskers reach the smallest and
 * largest values, and missing values are skipped and counted.
 */
export function boxSummary({
  values,
  whisker,
}: {
  readonly values: ReadonlyArray<number | null>;
  readonly whisker: WhiskerRule;
}): BoxSummaryResult {
  const five = fiveNumberSummary(values);

  if (five.kind === 'invalid') {
    return five;
  }

  const { min, q1, median, q3, max, count } = five.summary;
  const reach = whisker === 'tukey' ? TUKEY_FENCE * (q3 - q1) : Number.POSITIVE_INFINITY;
  const sorted = sortedValues(values);
  const within = sorted.filter((value) => value >= q1 - reach && value <= q3 + reach);

  return {
    kind: 'ok',
    summary: {
      low: within[0] ?? min,
      q1,
      median,
      q3,
      high: within.at(-1) ?? max,
      outliers: sorted.filter((value) => value < q1 - reach || value > q3 + reach),
      count,
    },
    whisker,
    skipped: five.skipped,
  };
}

const whiskerNotes: Readonly<Record<WhiskerRule, string>> = {
  tukey: 'Boxes show quartiles (linear interpolation); whiskers reach 1.5 × IQR (Tukey); points beyond are outliers.',
  range: 'Boxes show quartiles (linear interpolation); whiskers reach the smallest and largest values.',
};

/**
 * The footnote for `boxSummary`: the quartile method, the whisker rule and the values left out, as in "Boxes show
 * quartiles; whiskers reach 1.5 × IQR (Tukey); points beyond are outliers."
 */
export function describeBoxSummary({
  result,
  locale,
}: {
  readonly result: TransformOk<BoxSummaryResult>;
  readonly locale: string;
}): string {
  const missing = leftOutNote({ count: result.skipped, locale });

  return `${whiskerNotes[result.whisker]}${missing}`;
}

/** One step of an empirical cumulative distribution. */
export type EcdfPoint = {
  readonly id: string;
  readonly value: number;
  /** The share of values at or below `value`, from 0 to 1. */
  readonly probability: number;
};

export type EcdfResult = TransformResult<{
  readonly points: ReadonlyArray<EcdfPoint>;
  readonly count: number;
  /** Values that were missing (null, NaN or infinite). */
  readonly skipped: number;
}>;

/**
 * The empirical cumulative distribution: for each distinct value, the share of all values at or below it. A step chart
 * of these points rises by 1/n at every value, and missing values are skipped and counted.
 */
export function ecdfPoints(values: ReadonlyArray<number | null>): EcdfResult {
  const sorted = sortedValues(values);

  if (sorted.length === 0) {
    return invalid('There are no values to accumulate.');
  }

  return {
    kind: 'ok',
    points: sorted.flatMap((value, index) =>
      sorted[index + 1] === value ? [] : [{ id: `value-${index}`, value, probability: (index + 1) / sorted.length }],
    ),
    count: sorted.length,
    skipped: values.length - sorted.length,
  };
}

/**
 * The footnote for `ecdfPoints`: how many values the curve accumulates and how many were left out, as in "Empirical
 * cumulative share of 1,200 values."
 */
export function describeEcdf({
  result,
  locale,
}: {
  readonly result: TransformOk<EcdfResult>;
  readonly locale: string;
}): string {
  const missing = leftOutNote({ count: result.skipped, locale });

  return `Empirical cumulative share of ${noteNumber(result.count, locale)} values.${missing}`;
}
