import { hasUniqueIds } from '../chart-input.ts';
import { scaleDomainError } from '../plot/scale.ts';
import type { NumericDomain, ScaleType } from '../plot/scale.ts';

/** The most records each distribution chart draws. Larger input is refused with a message that names the limit. */
export const distributionLimits = { bins: 200, cumulativePoints: 2000, rows: 200 } as const;

/** Why a distribution chart cannot draw its records on a domain, or undefined when it can. */
export function distributionInputError({
  items,
  domain,
  scale,
  maxEntries,
}: {
  readonly items: ReadonlyArray<{ readonly id: string }>;
  readonly domain: NumericDomain;
  readonly scale?: ScaleType | undefined;
  readonly maxEntries: number;
}): string | undefined {
  const domainError = scaleDomainError(domain, scale);

  if (domainError !== undefined) {
    return domainError;
  }

  if (!hasUniqueIds(items)) {
    return 'Chart records must have unique identifiers.';
  }

  if (items.length > maxEntries) {
    return `This chart supports at most ${maxEntries} records. Supply an explicit data window or aggregation.`;
  }

  return undefined;
}
