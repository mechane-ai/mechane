import { hasUniqueIds } from '../chart-input.ts';
import { outsideDomain, scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain, ScaleType } from '../plot/scale.ts';

/** One point of a density curve the application computed: how much of the data lies near `value`. */
export type DensityPoint = { readonly value: number; readonly density: number };

const DENSITY_POINTS_MIN = 2;

/**
 * Why a chart of named groups cannot draw, or undefined when it can. The reasons are a domain the scale cannot carry,
 * groups that share an identifier, or more groups than the chart draws.
 */
export function groupFrameError({
  records,
  limit,
  noun,
  domain,
  scale,
}: {
  readonly records: ReadonlyArray<{ readonly id: string }>;
  readonly limit: number;
  /** What the records are, in the plural: "groups" or "rows". */
  readonly noun: string;
  readonly domain: NumericDomain;
  readonly scale?: ScaleType | undefined;
}): string | undefined {
  const domainError = scaleDomainError(domain, scale);

  if (domainError !== undefined) {
    return domainError;
  }

  if (!hasUniqueIds(records)) {
    return `Each of the ${noun} needs a unique identifier.`;
  }

  if (records.length > limit) {
    return `This chart draws at most ${limit} ${noun}.`;
  }

  return undefined;
}

function densityError({
  id,
  density,
  domain,
  limit,
}: {
  readonly id: string;
  readonly density: ReadonlyArray<DensityPoint>;
  readonly domain: NumericDomain;
  readonly limit: number;
}): string | undefined {
  if (density.length < DENSITY_POINTS_MIN) {
    return `${id} needs at least ${DENSITY_POINTS_MIN} density points.`;
  }

  if (density.length > limit) {
    return `${id} exceeds ${limit} density points. Supply a coarser density.`;
  }

  const isIncreasing = density.every(
    (point, index) => index === 0 || point.value > (density[index - 1]?.value ?? Number.NEGATIVE_INFINITY),
  );

  if (!isIncreasing || density.some((point) => outsideDomain(point.value, domain))) {
    return `${id} needs strictly increasing values inside the declared domain.`;
  }

  if (density.some((point) => !Number.isFinite(point.density) || point.density < 0)) {
    return `${id} has a density that is negative or not finite.`;
  }

  return undefined;
}

/** The first problem in the density curves of a chart, or undefined when each can be drawn. */
export function densitiesError({
  records,
  domain,
  limit,
}: {
  readonly records: ReadonlyArray<{ readonly id: string; readonly density: ReadonlyArray<DensityPoint> }>;
  readonly domain: NumericDomain;
  readonly limit: number;
}): string | undefined {
  const problems = records.map((record) => densityError({ id: record.id, density: record.density, domain, limit }));

  return problems.find((problem) => problem !== undefined) ?? undefined;
}

/** The highest density among all curves. Charts that share one density scale divide by it. */
export function maxDensity(records: ReadonlyArray<{ readonly density: ReadonlyArray<DensityPoint> }>): number {
  return Math.max(0, ...records.flatMap((record) => record.density.map((point) => point.density)));
}

/** The point where a curve is highest, the first one when several tie. It reads a supplied point, computing nothing. */
export function peakPoint(density: ReadonlyArray<DensityPoint>): DensityPoint | undefined {
  const top = Math.max(0, ...density.map((point) => point.density));

  return density.find((point) => point.density === top);
}
