import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { FigureProps } from '../../../charts/src/index.ts';
import { AttentionMatrix } from '../../../charts/src/matrix/index.ts';
import type { AttentionToken } from '../../../charts/src/matrix/index.ts';
import { TokenLinks } from '../../../charts/src/text/index.ts';
import { Button } from '../../../core/src/index.ts';
import { Notice } from '../../../feedback/src/index.ts';
import { spacing } from '../../../foundations/src/tokens.stylex.ts';
import { repeatedFeatureId } from './features.ts';
import type { InterpretabilityChangeDetails } from './features.ts';
import { kitStyles } from './kit-styles.ts';
import { SharedLink } from './shared-link.tsx';

/** One attention head: its name and its attention pattern over the shared tokens. */
export type AttentionHead = {
  readonly id: string;
  /** "Layer 5 · head 1". */
  readonly label: string;
  /** A short note on what the head appears to do: "Attends to the previous token". */
  readonly description?: string | undefined;
  /**
   * Weights in [0, 1] as a model computes them: one line per destination (the token that attends), one weight per
   * source (the token attended to), in token order. Null marks a masked or unrecorded pair.
   */
  readonly weights: ReadonlyArray<ReadonlyArray<number | null>>;
};

/** The words around the heads. Each has an English default. */
export type AttentionHeadGridLabels = {
  readonly inspect: string;
  readonly inspecting: string;
  readonly heads: string;
  readonly links: string;
  readonly linksDescription: string;
  readonly weight: string;
};

export type AttentionHeadGridProps = Pick<
  FigureProps,
  'title' | 'description' | 'locale' | 'status' | 'coverage' | 'source'
> & {
  /** The sequence every head attends over, as both sources and destinations. */
  readonly tokens: ReadonlyArray<AttentionToken>;
  readonly heads: ReadonlyArray<AttentionHead>;
  /** `causal` draws each pair where a token would read a later token as masked. Their weights must be null. */
  readonly mask?: 'none' | 'causal' | undefined;
  /** The head shown enlarged, with its links. Absent or null enlarges the first head. */
  readonly selected?: string | null | undefined;
  readonly onSelectedChange?: ((id: string, details: InterpretabilityChangeDetails) => void) | undefined;
  /**
   * The pair marked in every head, as `matrixCellId(destination, source)`: the token that attends, then the token
   * attended to. Every head shows it, and pointing at a pair in one head marks it in every head.
   */
  readonly pair?: string | null | undefined;
  readonly onPairChange?: ((id: string, details: InterpretabilityChangeDetails) => void) | undefined;
  /** The narrowest a small head panel may be, in CSS pixels. */
  readonly minPanelWidth?: number | undefined;
  readonly labels?: Partial<AttentionHeadGridLabels> | undefined;
};

/** The most heads the grid draws at once. Supply one layer, or the heads a study is about. */
export const attentionHeadLimits = { heads: 32 } as const;

const PANEL_WIDTH = 240;

const defaultLabels: AttentionHeadGridLabels = {
  inspect: 'Enlarge',
  inspecting: 'Enlarged',
  heads: 'Every head',
  links: 'Where each token looks',
  linksDescription:
    'Each line runs from a token in the top row down to a token that attends to it. Wider is more weight.',
  weight: 'Attention weight',
};

const styles = stylex.create({
  heading: { display: 'grid', gap: spacing.xs, minWidth: 0 },
  panels: (minimum: number) => ({
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(min(${minimum}px, 100%), 1fr))`,
    gap: spacing.lg,
    alignItems: 'start',
    minWidth: 0,
  }),
});

/**
 * Attention heads as small multiples, the way circuit papers compare them: one color-only attention pattern per head
 * over the same tokens and the same 0 to 1 color scale. The selected head is drawn large, beside the lines from each
 * token to the tokens it attends to. Attention weights describe where a head reads from, and are not by themselves an
 * explanation of what it computes.
 */
export function AttentionHeadGrid({
  title,
  description,
  locale,
  status,
  coverage,
  source,
  tokens,
  heads,
  mask = 'none',
  selected = null,
  onSelectedChange,
  pair,
  onPairChange,
  minPanelWidth = PANEL_WIDTH,
  labels: given,
}: AttentionHeadGridProps): ReactNode {
  const labels = { ...defaultLabels, ...given };
  const [ownPair, setOwnPair] = useState<string | null>(null);
  const marked = pair === undefined ? ownPair : pair;
  const repeated = repeatedFeatureId(heads.map((head) => head.id));
  const focus = heads.find((head) => head.id === selected) ?? heads[0];

  const isSelectedMissing = selected !== null && !heads.some((head) => head.id === selected);

  const problem =
    (repeated === undefined ? undefined : `Head ${repeated} appears twice. Heads must have unique identifiers.`) ??
    (heads.length > attentionHeadLimits.heads
      ? `This grid draws at most ${attentionHeadLimits.heads} heads.`
      : undefined) ??
    (isSelectedMissing ? `The selected head ${selected} is not among the heads.` : undefined);

  if (problem !== undefined) {
    return <Notice hasError>{`${title}: ${problem}`}</Notice>;
  }

  function markPair(id: string, event: Event | undefined): void {
    setOwnPair(id);
    onPairChange?.(id, { reason: 'press', event });
  }

  const shared = { locale, status, coverage, source, sources: tokens, destinations: tokens, mask } as const;

  return (
    <SharedLink>
      <section aria-label={title} {...stylex.props(kitStyles.stack)}>
        <div {...stylex.props(styles.heading)}>
          <h3 {...stylex.props(kitStyles.title)}>{title}</h3>
          {description !== undefined && <p {...stylex.props(kitStyles.muted)}>{description}</p>}
        </div>
        {focus !== undefined && (
          <div {...stylex.props(kitStyles.stack)}>
            <div {...stylex.props(kitStyles.tight)}>
              <AttentionMatrix
                {...shared}
                title={focus.label}
                description={focus.description}
                weights={focus.weights}
                valueLabel={`${labels.weight}, ${focus.label}`}
                selected={marked}
                onSelectedChange={(id, details) => markPair(id, details.event)}
              />
            </div>
            <div {...stylex.props(kitStyles.tight)}>
              <TokenLinks
                title={labels.links}
                description={labels.linksDescription}
                locale={locale}
                status={status}
                tokens={tokens.map((token) => ({ id: token.id, text: token.text }))}
                links={tokens.flatMap((destination, row) =>
                  tokens.flatMap((attended, column) => {
                    const weight = focus.weights[row]?.[column] ?? null;

                    return weight === null || weight === 0
                      ? []
                      : [{ sourceId: attended.id, destinationId: destination.id, weight }];
                  }),
                )}
                weightLabel={labels.weight}
                valueFormat={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                domain={[0, 1]}
                direction="source-to-destination"
              />
            </div>
          </div>
        )}
        <p {...stylex.props(kitStyles.label)}>{labels.heads}</p>
        <div {...stylex.props(styles.panels(minPanelWidth))}>
          {heads.map((head) => (
            <AttentionMatrix
              key={head.id}
              {...shared}
              title={head.label}
              weights={head.weights}
              cellValues="hidden"
              valueLabel={`${labels.weight}, ${head.label}`}
              selected={marked}
              onSelectedChange={(id, details) => markPair(id, details.event)}
              actions={
                <Button
                  variant={head.id === focus?.id ? 'solid' : 'outline'}
                  density="compact"
                  aria-pressed={head.id === focus?.id}
                  aria-label={`${labels.inspect} ${head.label}`}
                  onClick={(event) => onSelectedChange?.(head.id, { reason: 'press', event: event.nativeEvent })}
                >
                  {head.id === focus?.id ? labels.inspecting : labels.inspect}
                </Button>
              }
            />
          ))}
        </div>
      </section>
    </SharedLink>
  );
}
