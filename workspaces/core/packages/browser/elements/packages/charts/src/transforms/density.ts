import type { NumericDomain } from '../plot/scale.ts';
import { sortedQuantile } from './quantiles.ts';
import { invalid, isCount, leftOutNote, noteNumber, sortedValues, squaredDeviation, sum } from './values.ts';
import type { TransformOk, TransformResult } from './values.ts';

const SILVERMAN_FACTOR = 0.9;
const IQR_PER_DEVIATION = 1.34;
const SILVERMAN_POWER = -0.2;
const LOWER_QUARTILE = 0.25;
const UPPER_QUARTILE = 0.75;
const GAUSSIAN_NORM = 1 / Math.sqrt(Math.PI + Math.PI);
const SPREAD_VALUES_MIN = 2;
const HALF = 0.5;
const DOMAIN_BANDWIDTHS = 3;

/** The number of points and values a density estimate accepts. */
export const densityLimits = { pointsDefault: 128, pointsMin: 2, pointsMax: 2000 } as const;

/** One point of a density curve. */
export type DensityPoint = {
  readonly value: number;
  /** The estimated share of values per unit of `value` near this point. */
  readonly density: number;
};

/**
 * Silverman's rule of thumb for the width of a Gaussian kernel: 0.9 × min(standard deviation, IQR / 1.34) × n^(−1/5).
 * It suits roughly bell-shaped data and oversmooths several peaks. Missing values are skipped, and it returns null for
 * fewer than two values or values that do not vary.
 */
export function silvermanBandwidth(values: ReadonlyArray<number | null>): number | null {
  const sorted = sortedValues(values);
  const deviation = sorted.length < SPREAD_VALUES_MIN ? 0 : Math.sqrt(squaredDeviation(sorted) / (sorted.length - 1));

  const quartileSpread =
    ((sortedQuantile(sorted, UPPER_QUARTILE) ?? 0) - (sortedQuantile(sorted, LOWER_QUARTILE) ?? 0)) / IQR_PER_DEVIATION;

  const spread = quartileSpread > 0 ? Math.min(deviation, quartileSpread) : deviation;

  return spread > 0 ? SILVERMAN_FACTOR * spread * sorted.length ** SILVERMAN_POWER : null;
}

export type KernelDensityInput = {
  readonly values: ReadonlyArray<number | null>;
  /** How many evenly spaced points the curve has. Defaults to 128. */
  readonly points?: number | undefined;
  /** The kernel's standard deviation, in the values' unit. Leave it out to use Silverman's rule of thumb. */
  readonly bandwidth?: number | undefined;
  /** Where the curve is evaluated. Leave it out to reach three bandwidths past the smallest and largest value. */
  readonly domain?: NumericDomain | undefined;
};

export type KernelDensityResult = TransformResult<{
  readonly curve: ReadonlyArray<DensityPoint>;
  readonly bandwidth: number;
  /** True when the bandwidth came from Silverman's rule rather than the caller. */
  readonly isRuleOfThumb: boolean;
  readonly count: number;
  /** Values that were missing (null, NaN or infinite). */
  readonly skipped: number;
}>;

/**
 * A smooth estimate of how values are distributed, for violin and ridgeline plots. Every value contributes a small bell
 * curve (a Gaussian kernel) of width `bandwidth`, and the curve is their average, so its area is 1 over a domain
 * covering the data. Without a bandwidth it uses Silverman's rule of thumb, and missing values are skipped and
 * counted.
 */
export function kernelDensity({
  values,
  points = densityLimits.pointsDefault,
  bandwidth,
  domain,
}: KernelDensityInput): KernelDensityResult {
  const sorted = sortedValues(values);

  if (sorted.length === 0) {
    return invalid('There are no values to estimate a density from.');
  }

  if (!isCount(points, [densityLimits.pointsMin, densityLimits.pointsMax])) {
    return invalid(
      `The point count must be a whole number from ${densityLimits.pointsMin} to ${densityLimits.pointsMax}.`,
    );
  }

  if (bandwidth !== undefined && !(Number.isFinite(bandwidth) && bandwidth > 0)) {
    return invalid('The bandwidth must be a positive number.');
  }

  const width = bandwidth ?? silvermanBandwidth(sorted);

  if (width === null) {
    return invalid('The values do not vary, so Silverman’s rule gives no bandwidth. Supply one.');
  }

  const smallest = sorted[0] ?? 0;
  const largest = sorted.at(-1) ?? 0;
  const [start, stop] = domain ?? [smallest - DOMAIN_BANDWIDTHS * width, largest + DOMAIN_BANDWIDTHS * width];

  const isFiniteDomain = Number.isFinite(start) && Number.isFinite(stop);

  if (!(isFiniteDomain && stop > start)) {
    return invalid('The domain must be two finite numbers, the first below the second.');
  }

  const scale = GAUSSIAN_NORM / (sorted.length * width);

  return {
    kind: 'ok',
    curve: Array.from({ length: points }, (_, index) => {
      const value = start + ((stop - start) * index) / (points - 1);

      const kernels = sorted.map((observed) => {
        const distance = (value - observed) / width;

        return Math.exp(-HALF * distance * distance);
      });

      return { value, density: scale * sum(kernels) };
    }),
    bandwidth: width,
    isRuleOfThumb: bandwidth === undefined,
    count: sorted.length,
    skipped: values.length - sorted.length,
  };
}

/**
 * The footnote for `kernelDensity`: the kernel, the bandwidth and where it came from, as in "Gaussian kernel density,
 * bandwidth 0.42 (Silverman's rule)."
 */
export function describeKernelDensity({
  result,
  locale,
}: {
  readonly result: TransformOk<KernelDensityResult>;
  readonly locale: string;
}): string {
  const rule = result.isRuleOfThumb ? ' (Silverman’s rule)' : '';

  return `Gaussian kernel density, bandwidth ${noteNumber(result.bandwidth, locale)}${rule}.${leftOutNote({ count: result.skipped, locale })}`;
}
