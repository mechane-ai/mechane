import { columnExtent } from '../plot/scale.ts';
import type { NumericDomain } from '../plot/scale.ts';
import { invalid, leftOutNote, noteNumber, observedValues, tally } from './values.ts';
import type { TransformOk, TransformResult } from './values.ts';

const DECADE = 10;
const HALF_DECADE = 5;
const DOUBLE = 2;
const EDGE_TOLERANCE = 1e-9;

/** The most bins, columns or rows a binning transform makes. */
export const binLimits = { bins: 1000, cells: 1000 } as const;

/** One interval of a histogram and how many values fell in it. */
export type ValueBin = {
  readonly id: string;
  /** The interval as a reader sees it: "10–20". */
  readonly label: string;
  readonly lowerBound: number;
  readonly upperBound: number;
  readonly count: number;
};

export type BinValuesInput = {
  readonly values: ReadonlyArray<number | null>;
  /**
   * The outer edges, split exactly into bins. Leave it out to cover the values on round edges: multiples of 1, 2 or 5
   * times a power of ten.
   */
  readonly domain?: NumericDomain | undefined;
  /** The locale and number format the bin labels use. */
  readonly locale: string;
  readonly format?: Intl.NumberFormatOptions | undefined;
} & (
  | {
      /** About this many bins when the edges are round. */
      readonly binCount: number;
      readonly binWidth?: undefined;
    }
  | {
      /** Bins this wide when the edges are round. */
      readonly binWidth: number;
      readonly binCount?: undefined;
    }
);

export type BinValuesResult = TransformResult<{
  readonly bins: ReadonlyArray<ValueBin>;
  readonly binWidth: number;
  readonly domain: NumericDomain;
  /** Values that were missing (null, NaN or infinite). */
  readonly skipped: number;
  /** Values outside a supplied domain. */
  readonly outside: number;
}>;

/** The smallest step of 1, 2 or 5 times a power of ten that is at least `raw`. */
function roundStep(raw: number): number {
  const power = Math.floor(Math.log10(raw));
  const scaled = raw / DECADE ** power;
  const factor = [1, DOUBLE, HALF_DECADE].find((candidate) => scaled <= candidate * (1 + EDGE_TOLERANCE)) ?? DECADE;

  return power < 0 ? factor / DECADE ** -power : factor * DECADE ** power;
}

/** The `index`th multiple of a step, written without float noise when the step is a whole fraction such as 0.2. */
function stepMultiple(index: number, step: number): number {
  const inverse = Math.round(1 / step);

  return step < 1 && Math.abs(inverse * step - 1) < EDGE_TOLERANCE ? index / inverse : index * step;
}

/** The edges from the multiple of `step` at or below `low` to the one at or above `high`; at least one bin. */
function roundEdges(domain: NumericDomain, step: number): ReadonlyArray<number> {
  const first = Math.floor(domain[0] / step + EDGE_TOLERANCE);
  const last = Math.max(first + 1, Math.ceil(domain[1] / step - EDGE_TOLERANCE));

  return Array.from({ length: last - first + 1 }, (_, index) => stepMultiple(first + index, step));
}

/** The index of the bin that holds a value: bins include their lower edge, and the last bin also its upper edge. */
function binIndex(edges: ReadonlyArray<number>, value: number): number {
  const first = edges[0] ?? 0;
  const width = (edges.at(-1) ?? first) - first;
  const count = edges.length - 1;
  const estimate = Math.min(count - 1, Math.max(0, Math.floor(((value - first) / width) * count)));
  const isBelow = value < (edges[estimate] ?? value);
  const isAbove = estimate < count - 1 && value >= (edges[estimate + 1] ?? value);

  if (isBelow) {
    return estimate - 1;
  }

  return isAbove ? estimate + 1 : estimate;
}

function domainError(domain: NumericDomain): string | undefined {
  return Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[1] > domain[0]
    ? undefined
    : 'The domain must be two finite numbers, the first below the second.';
}

/** The edges about `count` round steps apart that cover the values; one unit wide when they do not vary. */
function coveringEdges(values: ReadonlyArray<number>, count: number): ReadonlyArray<number> | undefined {
  const bounds = columnExtent(values);

  return bounds === undefined
    ? undefined
    : roundEdges(bounds, roundStep((bounds[1] > bounds[0] ? bounds[1] - bounds[0] : 1) / count));
}

/** The domain that covers the values on round edges about `count` steps apart, or undefined for no values. */
function roundDomain(values: ReadonlyArray<number>, count: number): NumericDomain | undefined {
  const edges = coveringEdges(values, count);
  const low = edges?.[0];
  const high = edges?.at(-1);

  return low === undefined || high === undefined ? undefined : [low, high];
}

function binEdges(input: BinValuesInput, values: ReadonlyArray<number>): ReadonlyArray<number> | string {
  const { domain } = input;

  if (domain === undefined) {
    const bounds = columnExtent(values);

    if (input.binWidth === undefined) {
      return coveringEdges(values, input.binCount) ?? 'There are no values to bin.';
    }

    return bounds === undefined ? 'There are no values to bin.' : roundEdges(bounds, input.binWidth);
  }

  const width = input.binWidth ?? (domain[1] - domain[0]) / input.binCount;
  const count = Math.round((domain[1] - domain[0]) / width);

  if (Math.abs(count * width - (domain[1] - domain[0])) > EDGE_TOLERANCE * (domain[1] - domain[0])) {
    return 'The domain must span a whole number of bins of the given width.';
  }

  return Array.from({ length: count + 1 }, (_, index) => (index === count ? domain[1] : domain[0] + index * width));
}

/**
 * Count values in equal intervals for a histogram, skipping and counting missing values (null, NaN, infinite) and never
 * reading them as zero. Each bin holds its lower edge, and the last bin also holds its upper edge. Values outside a
 * supplied domain are left out and counted.
 */
export function binValues(input: BinValuesInput): BinValuesResult {
  const values = observedValues(input.values);
  const skipped = input.values.length - values.length;

  if (input.binCount !== undefined && !(Number.isInteger(input.binCount) && input.binCount >= 1)) {
    return invalid('The bin count must be a whole number of at least 1.');
  }

  if (input.binWidth !== undefined && !(Number.isFinite(input.binWidth) && input.binWidth > 0)) {
    return invalid('The bin width must be a positive number.');
  }

  const rangeError = input.domain === undefined ? undefined : domainError(input.domain);

  if (rangeError !== undefined) {
    return invalid(rangeError);
  }

  const edges = binEdges(input, values);

  if (typeof edges === 'string') {
    return invalid(edges);
  }

  if (edges.length - 1 > binLimits.bins) {
    return invalid(`Binning makes at most ${binLimits.bins} bins. Use a wider bin or a narrower domain.`);
  }

  const low = edges[0] ?? 0;
  const high = edges.at(-1) ?? low;
  const inside = values.filter((value) => value >= low && value <= high);

  const counts = tally(
    inside.map((value) => binIndex(edges, value)),
    edges.length - 1,
  );

  const label = new Intl.NumberFormat(input.locale, input.format);

  return {
    kind: 'ok',
    bins: counts.map((count, index) => {
      const lowerBound = edges[index] ?? low;
      const upperBound = edges[index + 1] ?? high;

      return {
        id: `bin-${index}`,
        label: `${label.format(lowerBound)}–${label.format(upperBound)}`,
        lowerBound,
        upperBound,
        count,
      };
    }),
    binWidth: (high - low) / (edges.length - 1),
    domain: [low, high],
    skipped,
    outside: values.length - inside.length,
  };
}

/**
 * The footnote for `binValues`: how many bins, how wide, and what was left out, as in "Counted in 20 bins of width
 * 0.5."
 */
export function describeBins({
  result,
  locale,
}: {
  readonly result: TransformOk<BinValuesResult>;
  readonly locale: string;
}): string {
  const missing = leftOutNote({ count: result.skipped, locale });

  const outside = leftOutNote({
    count: result.outside,
    noun: { one: 'value', other: 'values' },
    reason: 'outside the domain left out',
    locale,
  });

  return `Counted in ${result.bins.length} bins of width ${noteNumber(result.binWidth, locale)}.${missing}${outside}`;
}

export type Bin2dInput = {
  /** The horizontal positions; a point is `x[i]`, `y[i]`. */
  readonly x: ReadonlyArray<number | null>;
  readonly y: ReadonlyArray<number | null>;
  readonly columns: number;
  readonly rows: number;
  /** The horizontal extent. Without a domain, each axis covers its points on round edges. */
  readonly xDomain?: NumericDomain | undefined;
  readonly yDomain?: NumericDomain | undefined;
};

export type Bin2dResult = TransformResult<{
  readonly columns: number;
  readonly rows: number;
  /** One count per cell, row by row. Row 0 holds the lowest y and column 0 the lowest x, as `DensityMap` reads. */
  readonly counts: ReadonlyArray<number>;
  readonly xDomain: NumericDomain;
  readonly yDomain: NumericDomain;
  /** Points with a missing x or y. */
  readonly skipped: number;
  /** Points outside a supplied domain. */
  readonly outside: number;
}>;

function cellIndex(value: number, domain: NumericDomain, cells: number): number {
  return Math.min(cells - 1, Math.floor(((value - domain[0]) / (domain[1] - domain[0])) * cells));
}

/**
 * Count points in a grid of equal cells for a density map: `columns` across the x domain and `rows` up the y domain.
 * Cells hold their lower edges, and the last column and the top row also hold their upper edges. A point with a missing
 * x or y is skipped and counted, and a point outside a supplied domain is left out and counted.
 */
export function bin2d({ x, y, columns, rows, xDomain, yDomain }: Bin2dInput): Bin2dResult {
  if (x.length !== y.length) {
    return invalid('The x and y lists must have the same length.');
  }

  if (![columns, rows].every((count) => Number.isInteger(count) && count >= 1 && count <= binLimits.cells)) {
    return invalid(`Columns and rows must be whole numbers from 1 to ${binLimits.cells}.`);
  }

  const points = x.flatMap((left, index) => {
    const right = y[index] ?? null;

    if (left === null || right === null) {
      return [];
    }

    return Number.isFinite(left) && Number.isFinite(right) ? [{ x: left, y: right }] : [];
  });

  const across =
    xDomain ??
    roundDomain(
      points.map((point) => point.x),
      columns,
    );

  const up =
    yDomain ??
    roundDomain(
      points.map((point) => point.y),
      rows,
    );

  if (across === undefined || up === undefined) {
    return invalid('There are no points to bin.');
  }

  const rangeError = domainError(across) ?? domainError(up);

  if (rangeError !== undefined) {
    return invalid(rangeError);
  }

  const inside = points.filter((point) => {
    const isBetweenSides = point.x >= across[0] && point.x <= across[1];
    const isBetweenEnds = point.y >= up[0] && point.y <= up[1];

    return isBetweenSides && isBetweenEnds;
  });

  const cells = inside.map((point) => cellIndex(point.y, up, rows) * columns + cellIndex(point.x, across, columns));

  return {
    kind: 'ok',
    columns,
    rows,
    counts: tally(cells, columns * rows),
    xDomain: across,
    yDomain: up,
    skipped: x.length - points.length,
    outside: points.length - inside.length,
  };
}

/** The footnote for `bin2d`: the grid size and what was left out, as in "Counted in a 40 × 30 grid." */
export function describeBin2d({
  result,
  locale,
}: {
  readonly result: TransformOk<Bin2dResult>;
  readonly locale: string;
}): string {
  const missing = leftOutNote({
    count: result.skipped,
    noun: { one: 'point with a missing value', other: 'points with missing values' },
    reason: 'skipped',
    locale,
  });

  const outside = leftOutNote({
    count: result.outside,
    noun: { one: 'point', other: 'points' },
    reason: 'outside the domain left out',
    locale,
  });

  return `Counted in a ${result.columns} × ${result.rows} grid.${missing}${outside}`;
}
