import type { ChartTone } from '../../../foundations/src/chart-tones.ts';

export type BarSeries = {
  readonly id: string;
  readonly label: string;
  readonly values: ReadonlyArray<number | null>;
  readonly tone?: ChartTone | undefined;
};

export type BarBucket = { readonly kind: 'parts' | 'total'; readonly total: number } | { readonly kind: 'gap' };

export type BarComposition = {
  readonly buckets: ReadonlyArray<BarBucket>;
  readonly contextLabel: string;
  readonly focusedSeries?: BarSeries | undefined;
  readonly annotation?: { readonly categoryId: string; readonly value: number; readonly label: string } | undefined;
};

type CompositionInput = {
  readonly composition: BarComposition | undefined;
  readonly series: ReadonlyArray<BarSeries>;
  readonly categoryIds: ReadonlyArray<string>;
  readonly domain: readonly [number, number];
};

export function validateComposition({
  composition,
  series,
  categoryIds,
  domain,
}: CompositionInput): string | undefined {
  if (composition === undefined) {
    return undefined;
  }

  if (composition.buckets.length !== categoryIds.length) {
    return 'Composition requires one explicit bucket per category.';
  }

  const annotation = composition.annotation;

  if (annotation !== undefined) {
    if (!categoryIds.includes(annotation.categoryId) || !Number.isFinite(annotation.value)) {
      return 'A bar annotation requires an existing category and a finite value.';
    }

    if (annotation.value < domain[0] || annotation.value > domain[1]) {
      return 'A bar annotation must fit the supplied domain.';
    }
  }

  for (const [index, bucket] of composition.buckets.entries()) {
    if (bucket.kind !== 'gap') {
      if (!Number.isFinite(bucket.total) || bucket.total < domain[0] || bucket.total > domain[1]) {
        return 'Context totals must be finite and inside the supplied domain.';
      }

      if (bucket.kind === 'parts') {
        const values = series.map((item) => item.values[index]);

        if (values.some((value) => value !== null && value !== undefined && value < 0)) {
          return 'Composition parts require nonnegative reported values.';
        }

        const total = values.reduce<number>((amount, value) => amount + (value ?? 0), 0);

        if (total > domain[1] || bucket.total < 0) {
          return 'Composition parts must fit the supplied positive domain.';
        }
      }
    }
  }

  return undefined;
}
