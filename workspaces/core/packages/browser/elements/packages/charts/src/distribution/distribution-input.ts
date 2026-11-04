import { hasUniqueIds, isFiniteDomain } from '../chart-input.tsx';

export type NumericDomain = readonly [minimum: number, maximum: number];

export const distributionLimits = { bins: 200, cumulativePoints: 2000, rows: 200 } as const;

export function distributionInputError({
  items,
  domain,
  maxEntries,
}: {
  readonly items: ReadonlyArray<{ readonly id: string }>;
  readonly domain: NumericDomain;
  readonly maxEntries: number;
}): string | undefined {
  if (!isFiniteDomain(domain)) {
    return 'The chart domain must contain two finite, increasing values.';
  }

  if (!hasUniqueIds(items)) {
    return 'Chart records must have unique identifiers.';
  }

  if (items.length > maxEntries) {
    return `This chart supports at most ${maxEntries} records. Supply an explicit data window or aggregation.`;
  }

  return undefined;
}

export function outsideDomain(value: number, domain: NumericDomain): boolean {
  return !Number.isFinite(value) || value < domain[0] || value > domain[1];
}
