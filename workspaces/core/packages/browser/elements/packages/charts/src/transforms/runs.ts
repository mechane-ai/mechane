import { sortedQuantile } from './quantiles.ts';
import { hasDistinctIds, invalid, leftOutNote, noteNumber, observedPoints } from './values.ts';
import type { SeriesPoint, TransformOk, TransformResult } from './values.ts';

const MEDIAN = 0.5;

/** One repeated run of the same measurement, such as a training seed. */
export type RunSeries = { readonly id: string; readonly points: ReadonlyArray<SeriesPoint> };

/** The middle of the runs at one step and the band that holds them. */
export type RunSummaryPoint = {
  readonly x: number;
  /** The median across runs. */
  readonly center: number;
  readonly lower: number;
  readonly upper: number;
};

export type SummarizeRunsInput = {
  readonly runs: ReadonlyArray<RunSeries>;
  /** The quantile for the band's lower edge, from 0 to 1: 0.25 for the lower quartile. */
  readonly lower: number;
  /** The quantile for the band's upper edge, from 0 to 1, at or above `lower`. */
  readonly upper: number;
  /** The fewest runs a step needs to be summarized. Defaults to every run. */
  readonly minimumRuns?: number | undefined;
};

export type SummarizeRunsResult = TransformResult<{
  readonly points: ReadonlyArray<RunSummaryPoint>;
  readonly lower: number;
  readonly upper: number;
  readonly runCount: number;
  readonly minimumRuns: number;
  /** Steps that fewer than `minimumRuns` runs reported. */
  readonly skippedSteps: number;
}>;

/**
 * The median and a quantile band across repeated runs, step by step, for a line with a pale band that never rests on
 * too few runs. At each x that at least `minimumRuns` runs report a value for, it takes the median of those values and
 * the `lower` and `upper` quantiles (linear interpolation, type 7). Steps reported by fewer runs are skipped and
 * counted, and a missing value does not count as a report.
 */
export function summarizeRuns({
  runs,
  lower,
  upper,
  minimumRuns = runs.length,
}: SummarizeRunsInput): SummarizeRunsResult {
  if (runs.length === 0) {
    return invalid('There are no runs to summarize.');
  }

  if (!(lower >= 0 && upper <= 1 && lower <= upper)) {
    return invalid('The band quantiles must lie from 0 to 1, lower first.');
  }

  if (!(Number.isInteger(minimumRuns) && minimumRuns >= 1 && minimumRuns <= runs.length)) {
    return invalid(`The minimum number of runs must be a whole number from 1 to ${runs.length}.`);
  }

  const observed = runs.map((run) => ({ id: run.id, points: observedPoints(run.points) }));
  const repeated = observed.find((run) => !hasDistinctIds(run.points.map((point) => String(point.x))));

  if (repeated !== undefined) {
    return invalid(`Run ${repeated.id} reports the same step more than once.`);
  }

  const steps = Map.groupBy(
    observed.flatMap((run) => run.points),
    (point) => point.x,
  );

  const ordered = [...steps.entries()].toSorted(([left], [right]) => left - right);

  const points = ordered.flatMap(([x, reports]) => {
    const sorted = reports.map((point) => point.y).toSorted((left, right) => left - right);
    const center = sortedQuantile(sorted, MEDIAN);
    const low = sortedQuantile(sorted, lower);
    const high = sortedQuantile(sorted, upper);

    const hasQuantiles = center !== null && low !== null && high !== null;
    const hasTooFewRuns = sorted.length < minimumRuns;

    return hasTooFewRuns || !hasQuantiles ? [] : [{ x, center, lower: low, upper: high }];
  });

  return {
    kind: 'ok',
    points,
    lower,
    upper,
    runCount: runs.length,
    minimumRuns,
    skippedSteps: ordered.length - points.length,
  };
}

/**
 * The footnote for `summarizeRuns`: the center, the band and the steps left out, as in "Median of 5 runs; band spans
 * quantiles 0.25 to 0.75."
 */
export function describeRunSummary({
  result,
  locale,
}: {
  readonly result: TransformOk<SummarizeRunsResult>;
  readonly locale: string;
}): string {
  const skipped = leftOutNote({
    count: result.skippedSteps,
    noun: { one: 'step', other: 'steps' },
    reason: `with fewer than ${noteNumber(result.minimumRuns, locale)} runs left out`,
    locale,
  });

  const band = `${noteNumber(result.lower, locale)} to ${noteNumber(result.upper, locale)}`;

  return `Median of ${noteNumber(result.runCount, locale)} runs; band spans quantiles ${band}.${skipped}`;
}
