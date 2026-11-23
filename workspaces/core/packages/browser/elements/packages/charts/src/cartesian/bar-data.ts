import type { ChartTone } from '../../../foundations/src/chart-tones.ts';
import type { NumericDomain } from '../plot/scale.ts';

/** One series of bars: a value per category, in category order, or null where none was recorded. */
export type BarSeries = {
  readonly id: string;
  readonly label: string;
  readonly values: ReadonlyArray<number | null>;
  readonly tone?: ChartTone | undefined;
};

/**
 * One category of a composition: `parts` stacks the series under a supplied total, `total` draws only the total, and
 * `gap` draws nothing.
 */
export type BarBucket = { readonly kind: 'parts' | 'total'; readonly total: number } | { readonly kind: 'gap' };

/** Supplied totals drawn as gray context behind the series, with an optional focused series. */
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
  readonly domain: NumericDomain;
};

/** Why a composition cannot be drawn on the value domain, or undefined when it can. */
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

/**
 * A second value drawn on each bar of one series, on the value axis rather than the stack. A tick marks one value, such
 * as the highest month against an average. A range draws a whisker between two supplied bounds.
 */
export type BarMarker = {
  readonly id: string;
  readonly label: string;
  /** The bar series whose bar width the marker spans. A stacked chart spans the whole stack. */
  readonly seriesId: string;
  /** Absent means the neutral tone. */
  readonly tone?: ChartTone | undefined;
} & (
  | { readonly kind: 'tick'; readonly values: ReadonlyArray<number | null> }
  | {
      readonly kind: 'range';
      readonly lower: ReadonlyArray<number | null>;
      readonly upper: ReadonlyArray<number | null>;
    }
);

/** A short visible note above one bar, such as "Peak". Long text belongs in the description. */
export type BarAnnotation = {
  readonly id: string;
  readonly categoryId: string;
  readonly label: string;
  /** Places the note above this series' bar in a grouped chart. Absent means above the category's tallest mark. */
  readonly seriesId?: string | undefined;
};

type OverlayInput = {
  readonly markers: ReadonlyArray<BarMarker>;
  readonly annotations: ReadonlyArray<BarAnnotation>;
  readonly emphasizedCategoryIds: ReadonlyArray<string>;
  readonly seriesIds: ReadonlyArray<string>;
  readonly categoryIds: ReadonlyArray<string>;
  readonly domain: NumericDomain;
};

const BAR_MARKERS_MAX = 6;

function isMarkedValue(value: number | null | undefined, domain: NumericDomain): boolean {
  if (value === null) {
    return true;
  }

  if (value === undefined || !Number.isFinite(value)) {
    return false;
  }

  return value >= domain[0] && value <= domain[1];
}

function markerProblem({
  marker,
  categoryCount,
  domain,
}: {
  readonly marker: BarMarker;
  readonly categoryCount: number;
  readonly domain: NumericDomain;
}): string | undefined {
  const columns = marker.kind === 'tick' ? [marker.values] : [marker.lower, marker.upper];

  if (columns.some((values) => values.length !== categoryCount)) {
    return 'Every bar marker requires one explicit value per category.';
  }

  if (columns.some((values) => values.some((value) => !isMarkedValue(value, domain)))) {
    return 'Bar marker values must be finite and within the supplied domain.';
  }

  if (marker.kind === 'range') {
    for (const [index, lower] of marker.lower.entries()) {
      const upper = marker.upper[index] ?? null;
      const isPartial = (lower === null) !== (upper === null);
      const isReversed = lower !== null && upper !== null && lower > upper;

      if (isPartial || isReversed) {
        return 'A range marker needs both bounds, with the lower bound at most the upper bound, or neither.';
      }
    }
  }

  return undefined;
}

/** Why bar markers, annotations or emphasis cannot be drawn, or undefined when they can. */
export function validateBarOverlays({
  markers,
  annotations,
  emphasizedCategoryIds,
  seriesIds,
  categoryIds,
  domain,
}: OverlayInput): string | undefined {
  if (markers.length > BAR_MARKERS_MAX) {
    return `Supply at most ${BAR_MARKERS_MAX} bar markers.`;
  }

  const overlayIds = [...markers, ...annotations];
  const isUniqueOverlay = new Set(overlayIds.map((overlay) => overlay.id)).size === overlayIds.length;

  if (!isUniqueOverlay || seriesIds.some((id) => overlayIds.some((overlay) => overlay.id === id))) {
    return 'Bar series, markers, and annotations require distinct identifiers.';
  }

  for (const marker of markers) {
    if (!seriesIds.includes(marker.seriesId)) {
      return 'Each bar marker must refer to a supplied series.';
    }

    const problem = markerProblem({ marker, categoryCount: categoryIds.length, domain });

    if (problem !== undefined) {
      return problem;
    }
  }

  for (const annotation of annotations) {
    const hasSeries = annotation.seriesId === undefined || seriesIds.includes(annotation.seriesId);
    const hasLabel = annotation.label.trim() !== '';
    const isPlaced = categoryIds.includes(annotation.categoryId) && hasSeries && hasLabel;

    if (!isPlaced) {
      return 'Each bar annotation needs a label, a supplied category, and a supplied series when it names one.';
    }
  }

  const anchors = new Set(
    annotations.map((annotation) => JSON.stringify([annotation.categoryId, annotation.seriesId ?? null])),
  );

  if (anchors.size !== annotations.length) {
    return 'Each bar can hold one annotation.';
  }

  const emphasized = new Set(emphasizedCategoryIds);

  if (
    emphasized.size !== emphasizedCategoryIds.length ||
    emphasizedCategoryIds.some((id) => !categoryIds.includes(id))
  ) {
    return 'Emphasized categories must be unique supplied categories.';
  }

  return undefined;
}

/** A marker's exact value at one category, as the readout and the table write it. */
export function markerValueLabel({
  marker,
  index,
  valueText,
}: {
  readonly marker: BarMarker;
  readonly index: number;
  /** Writes one value exactly, and a missing one as unavailable. */
  readonly valueText: (value: number | null) => string;
}): string {
  if (marker.kind === 'tick') {
    return valueText(marker.values[index] ?? null);
  }

  const lower = marker.lower[index] ?? null;
  const upper = marker.upper[index] ?? null;

  return lower === null || upper === null ? valueText(null) : `${valueText(lower)} – ${valueText(upper)}`;
}

/** The highest value a marker draws at one category, so an annotation can clear it. */
export function markerPeak(marker: BarMarker, index: number): number | null {
  if (marker.kind === 'tick') {
    return marker.values[index] ?? null;
  }

  return marker.upper[index] ?? null;
}
