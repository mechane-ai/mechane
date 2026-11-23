import type { HistogramBin } from '../../../charts/src/distribution/index.ts';
import { useChartLinkControl } from '../../../charts/src/index.ts';
import type { NumericDomain, PlotAxis, ValueFormat } from '../../../charts/src/index.ts';
import type { TokenExample, TokenPalette } from '../../../charts/src/text/index.ts';

/** Why an interpretability view asks for a change: a press, a typed or dragged input, or an agent's call. */
export type InterpretabilityChangeDetails = {
  readonly reason: 'press' | 'input' | 'imperative';
  readonly event?: Event | undefined;
};

/** What names a learned feature, such as a sparse autoencoder latent, wherever it appears. */
export type FeatureSummary = {
  /** The feature's id. It is the same in the list, the card, the map and the attribution graph. */
  readonly id: string;
  /** The short human name: "Golden Gate Bridge". */
  readonly label: string;
  /** Where the feature lives, such as "Layer 20 · 65k dictionary". */
  readonly source?: string | undefined;
  /** What the feature appears to detect, in a sentence or two, written by a person or a model. */
  readonly explanation?: string | undefined;
  /** The share of tokens on which the feature is active, between 0 and 1, or null where it was not measured. */
  readonly frequency?: number | null | undefined;
};

/** How often the feature reaches each activation: prepared histogram bins over the activation axis. */
export type FeatureDensity = {
  readonly bins: ReadonlyArray<HistogramBin>;
  readonly value: PlotAxis;
  readonly count: PlotAxis;
};

/** The contexts that activate the feature most, ranked by the application, with one color scale. */
export type FeatureExamples = {
  readonly examples: ReadonlyArray<TokenExample>;
  readonly domain: NumericDomain;
  /** Absent shades activations in one hue. */
  readonly palette?: TokenPalette | undefined;
  readonly valueFormat: ValueFormat;
  /** Tokens shown on each side of each example's peak. Every example then needs a `peakIndex`. */
  readonly context?: number | undefined;
};

/** One output token and the feature's direct effect on its logit: positive promotes it, negative suppresses it. */
export type FeatureLogit = { readonly id: string; readonly token: string; readonly value: number };

/** The tokens the feature pushes up and down, each list in the order the application ranked it. */
export type FeatureLogits = {
  readonly tokens: ReadonlyArray<FeatureLogit>;
  /** The effect's axis: its label and format. A domain, when given, must hold zero. */
  readonly value: PlotAxis;
};

/** Everything a feature card can show. Each part is optional; the card leaves out what is absent. */
export type FeatureCardData = {
  readonly feature: FeatureSummary;
  readonly density?: FeatureDensity | undefined;
  readonly examples?: FeatureExamples | undefined;
  readonly logits?: FeatureLogits | undefined;
};

/** The most features a list, a map's search or a workbench takes. */
export const featureLimits = { features: 5000, matches: 8 } as const;

/** True when the query is empty or a feature's label, id or explanation contains it, ignoring case. */
export function matchesQuery(feature: FeatureSummary, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase();

  return (
    needle.length === 0 ||
    [feature.label, feature.id, feature.explanation ?? ''].some((text) => text.toLocaleLowerCase().includes(needle))
  );
}

/** The first id that appears twice, or undefined. */
export function repeatedFeatureId(ids: ReadonlyArray<string>): string | undefined {
  return ids.find((id, index) => ids.indexOf(id) !== index);
}

/**
 * Hands the row or item a reader rests on to the enclosing chart link. A feature lit in a list or a search is then lit
 * in the map or graph beside it. Moving away clears only an id this view set, and outside a link it does nothing.
 */
export function useFeatureHighlight(ids: ReadonlyArray<string>): (id: string | undefined) => void {
  const link = useChartLinkControl();

  return (id) => {
    const isOwn = link?.inspected !== null && link?.inspected !== undefined && ids.includes(link.inspected);

    if (id !== undefined || isOwn) {
      link?.inspect(id ?? null, { reason: 'item-hover' });
    }
  };
}
