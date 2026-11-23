import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { Histogram } from '../../../charts/src/distribution/index.ts';
import { formatValue } from '../../../charts/src/index.ts';
import type { FigureStatus, ValueFormat } from '../../../charts/src/index.ts';
import { TokenExamples } from '../../../charts/src/text/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { FeatureLogitBars } from './feature-logits.tsx';
import type { FeatureLogitLabels } from './feature-logits.tsx';
import type { FeatureCardData } from './features.ts';
import { kitStyles } from './kit-styles.ts';

/** How much of a feature a card shows: a compact card for grids and side panels, or the full card for a detail page. */
export type FeatureCardSize = 'compact' | 'full';

/** The words on a feature card. Each has an English default. */
export type FeatureCardLabels = FeatureLogitLabels & {
  readonly density: string;
  readonly densityDescription: string;
  readonly examples: string;
  readonly examplesDescription: string;
  readonly activation: string;
  readonly frequency: string;
  readonly noData: string;
};

export type FeatureCardProps = FeatureCardData & {
  readonly locale: string;
  readonly status?: FigureStatus | undefined;
  /** Use `compact` in grids and side panels, and `full` on a feature's own page. */
  readonly size?: FeatureCardSize | undefined;
  /** How the activation frequency is written. Absent writes a percent with two significant digits. */
  readonly frequencyFormat?: ValueFormat | undefined;
  /** Controls beside the feature's name, such as a pin or a link to its page. */
  readonly actions?: ReactNode;
  readonly labels?: Partial<FeatureCardLabels> | undefined;
};

const COMPACT_EXAMPLES = 3;
const COMPACT_CONTEXT = 6;
const frequencyDefault = { style: 'percent', maximumSignificantDigits: 2 } as const;

const defaultLabels: FeatureCardLabels = {
  density: 'Activation density',
  densityDescription: 'How many tokens reach each activation, among the tokens where the feature is active.',
  examples: 'Top activations',
  examplesDescription: 'The contexts where the feature is most active. Darker tokens are more active.',
  activation: 'Activation',
  frequency: 'Active on',
  noData: 'No activations, examples or output effects were supplied for this feature.',
  promotes: 'Promotes',
  suppresses: 'Suppresses',
  logitsDescription: 'The output tokens whose logits the feature raises or lowers most, by direct effect.',
};

const styles = stylex.create({
  header: { display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', gap: spacing.sm, minWidth: 0 },
  name: { display: 'grid', gap: spacing.xxs, flexGrow: 1, flexBasis: '12rem', minWidth: 0 },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(340px, 100%), 1fr))',
    gap: spacing.xl,
    alignItems: 'start',
    minWidth: 0,
  },
});

/**
 * One learned feature at a glance, as interpretability papers and feature browsers show it. The card shows its name, id
 * and explanation, how often it fires and how strongly, the contexts that activate it most, and the output tokens it
 * promotes and suppresses. Supply only the parts you have, and the card leaves out the rest.
 */
export function FeatureCard({
  feature,
  density,
  examples,
  logits,
  locale,
  status,
  size = 'full',
  frequencyFormat = frequencyDefault,
  actions,
  labels: given,
}: FeatureCardProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const isCompact = size === 'compact';
  const hasFrequency = feature.frequency !== undefined;

  const meta = [
    feature.id,
    feature.source,
    hasFrequency
      ? `${labels.frequency} ${formatValue({ value: feature.frequency ?? null, locale, format: frequencyFormat })}`
      : undefined,
  ].filter((part) => part !== undefined);

  const isBare = density === undefined && examples === undefined && logits === undefined;

  const densityFigure = density !== undefined && (
    <Histogram
      title={labels.density}
      description={isCompact ? undefined : labels.densityDescription}
      locale={locale}
      status={status}
      bins={density.bins}
      value={density.value}
      count={density.count}
      height="compact"
    />
  );

  const hasMoreExamples = examples !== undefined && examples.examples.length > COMPACT_EXAMPLES;
  const isTrimmed = isCompact && hasMoreExamples;
  const examplesPalette = examples?.palette ?? 'sequential';

  const examplesFigure = examples !== undefined && (
    <TokenExamples
      title={labels.examples}
      description={isCompact ? undefined : labels.examplesDescription}
      locale={locale}
      status={status}
      examples={isCompact ? examples.examples.slice(0, COMPACT_EXAMPLES) : examples.examples}
      coverage={isTrimmed ? { shown: COMPACT_EXAMPLES, total: examples.examples.length, unit: 'examples' } : undefined}
      domain={examples.domain}
      palette={examplesPalette}
      valueLabel={labels.activation}
      valueFormat={examples.valueFormat}
      context={isCompact ? (examples.context ?? COMPACT_CONTEXT) : examples.context}
    />
  );

  const logitFigure = logits !== undefined && (
    <FeatureLogitBars logits={logits} locale={locale} status={status} isCompact={isCompact} labels={labels} />
  );

  return (
    <article aria-label={feature.label} {...stylex.props(kitStyles.card)}>
      <div {...stylex.props(styles.header)}>
        <div {...stylex.props(styles.name)}>
          <h3 {...stylex.props(kitStyles.title)}>{feature.label}</h3>
          <p {...stylex.props(kitStyles.meta)}>{meta.join(' · ')}</p>
        </div>
        {actions}
      </div>
      {feature.explanation !== undefined && <p {...stylex.props(kitStyles.body)}>{feature.explanation}</p>}
      {isBare && <p {...stylex.props(kitStyles.muted)}>{labels.noData}</p>}
      {isCompact ? (
        <>
          {logitFigure}
          {densityFigure}
          {examplesFigure}
        </>
      ) : (
        <>
          {(examplesFigure !== false || densityFigure !== false) && (
            <div {...stylex.props(styles.columns)}>
              {examplesFigure}
              {densityFigure}
            </div>
          )}
          {logitFigure}
        </>
      )}
    </article>
  );
}
