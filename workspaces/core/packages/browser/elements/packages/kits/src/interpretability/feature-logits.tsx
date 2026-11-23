import * as stylex from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { RankedBars } from '../../../charts/src/distribution/index.ts';
import type { FigureStatus } from '../../../charts/src/index.ts';
import { quoteToken } from '../../../charts/src/text/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import type { FeatureLogit, FeatureLogits } from './features.ts';
import { kitStyles } from './kit-styles.ts';

/** The words around the promoted and suppressed tokens. */
export type FeatureLogitLabels = {
  readonly promotes: string;
  readonly suppresses: string;
  readonly logitsDescription: string;
};

type FeatureLogitsProps = {
  readonly logits: FeatureLogits;
  readonly locale: string;
  readonly status?: FigureStatus | undefined;
  readonly isCompact: boolean;
  readonly labels: FeatureLogitLabels;
};

const COMPACT_TOKENS = 5;

const styles = stylex.create({
  pair: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))',
    gap: spacing.xl,
    alignItems: 'start',
    minWidth: 0,
  },
  line: { display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', gap: spacing.sm, alignItems: 'baseline' },
});

/**
 * What the feature does to the output: the tokens whose logits it raises, in the positive hue, and the tokens it
 * lowers, in the negative hue. Both bar lists share one magnitude, so a long bar means the same in each. The compact
 * form writes the leading tokens as text.
 */
export function FeatureLogitBars({ logits, locale, status, isCompact, labels }: FeatureLogitsProps): ReactNode {
  const promoted = logits.tokens.filter((entry) => entry.value > 0);
  const suppressed = logits.tokens.filter((entry) => entry.value < 0);

  const bound = Math.max(
    ...(logits.value.domain ?? [0]).map(Math.abs),
    ...logits.tokens.map((entry) => Math.abs(entry.value)),
  );

  const reach = bound > 0 ? bound : 1;

  if (isCompact && status === 'loading') {
    return null;
  }

  if (isCompact) {
    return (
      <div {...stylex.props(kitStyles.tight)}>
        {[
          { id: 'promotes', label: labels.promotes, tokens: promoted },
          { id: 'suppresses', label: labels.suppresses, tokens: suppressed },
        ]
          .filter((group) => group.tokens.length > 0)
          .map((group) => (
            <div key={group.id} {...stylex.props(styles.line)}>
              <p {...stylex.props(kitStyles.label)}>{group.label}</p>
              <ul {...stylex.props(kitStyles.list)}>
                {group.tokens.slice(0, COMPACT_TOKENS).map((entry) => (
                  <li key={entry.id} {...stylex.props(kitStyles.token)}>
                    {entry.token}
                  </li>
                ))}
              </ul>
            </div>
          ))}
      </div>
    );
  }

  function bars(
    tokens: ReadonlyArray<FeatureLogit>,
    tone: 'positive' | 'negative',
  ): ReadonlyArray<{
    readonly id: string;
    readonly label: string;
    readonly value: number;
    readonly tone: 'positive' | 'negative';
  }> {
    return tokens.map((entry) => ({ id: entry.id, label: quoteToken(entry.token), value: entry.value, tone }));
  }

  return (
    <div {...stylex.props(styles.pair)}>
      <RankedBars
        title={labels.promotes}
        description={labels.logitsDescription}
        locale={locale}
        status={status}
        items={bars(promoted, 'positive')}
        value={{ ...logits.value, domain: [0, reach] }}
      />
      <RankedBars
        title={labels.suppresses}
        locale={locale}
        status={status}
        items={bars(suppressed, 'negative')}
        value={{ ...logits.value, domain: [-reach, 0] }}
      />
    </div>
  );
}
