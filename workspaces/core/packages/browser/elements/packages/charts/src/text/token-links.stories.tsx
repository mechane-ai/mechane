import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { TokenLinks } from './token-links.tsx';
import type { TokenLink, TokenLinkToken } from './token-links.tsx';

const meta = {
  title: 'Charts/TokenLinks',
  component: TokenLinks,
  parameters: {
    docs: {
      description: {
        component:
          'Which tokens attend to which: the sequence drawn as a row of sources (the tokens attended to) above a row of destinations (the tokens that attend), joined by straight lines whose width and opacity follow the weight. Inspect or select a token to see only its links and read its strongest weights; inside a `ChartLink` the inspected token is shared with the other token charts. The application supplies the tokens, every link and the weight domain; long sequences scroll sideways inside the frame.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function sequence(words: ReadonlyArray<string>): ReadonlyArray<TokenLinkToken> {
  return words.map((text, index) => ({ id: `t${index}`, text }));
}

/**
 * A synthetic causal head: each token gives 0.7 of its weight to `focus(index)` and spreads the rest over earlier
 * tokens.
 */
function causalHead(tokens: ReadonlyArray<TokenLinkToken>, focus: (index: number) => number): ReadonlyArray<TokenLink> {
  return tokens.flatMap((destination, index) =>
    tokens.slice(0, index + 1).flatMap((source, position) => {
      const isFocus = position === focus(index);
      const share = index === 0 ? 1 : 0.3 / index;
      const value = Math.round((isFocus ? Math.max(share, 0.7) : share) * 100) / 100;

      return value < 0.02 ? [] : [{ sourceId: source.id, destinationId: destination.id, weight: value }];
    }),
  );
}

const sentence = sequence(['The', ' cat', ' sat', ' on', ' the', ' mat', '.', '\n', 'It', ' purred']);
const previousToken = causalHead(sentence, (index) => Math.max(0, index - 1));
const weight = { maximumFractionDigits: 2 } as const;

export const PreviousTokenHead: Story = {
  render: () => (
    <TokenLinks
      title="Layer 2, head 5: previous-token head"
      description="Synthetic weights. Most of each token's attention goes to the token just before it."
      locale="en-US"
      tokens={sentence}
      links={previousToken}
      weightLabel="Attention weight"
      valueFormat={weight}
      domain={[0, 1]}
      direction="source-to-destination"
      source="Synthetic attention pattern"
      transforms={['Weights under 0.02 omitted']}
    />
  ),
};

const words = [
  'When',
  ' Mary',
  ' and',
  ' John',
  ' went',
  ' to',
  ' the',
  ' store',
  ',',
  ' John',
  ' gave',
  ' a',
  ' drink',
  ' to',
];

const longSequence = sequence(Array.from({ length: 56 }, (_, index) => words[index % words.length] ?? ''));
const induction = causalHead(longSequence, (index) => (index >= words.length ? index - words.length + 1 : 0));

export const LongSequence: Story = {
  render: () => (
    <TokenLinks
      title="Induction head on a repeated sequence"
      description="Synthetic. The sentence repeats every 14 tokens; the chart scrolls sideways inside its frame."
      locale="en-US"
      tokens={longSequence}
      links={induction}
      weightLabel="Attention weight"
      valueFormat={weight}
      domain={[0, 1]}
      direction="source-to-destination"
    />
  ),
};

function PinnedToken() {
  const [selected, setSelected] = useState<string | null>('t9');

  return (
    <TokenLinks
      title="Pin a token"
      description={`Synthetic. Press a token or use Enter to pin it. Pinned: ${selected ?? 'none'}.`}
      locale="en-US"
      tokens={sentence}
      links={previousToken}
      weightLabel="Attention weight"
      valueFormat={weight}
      domain={[0, 1]}
      direction="source-to-destination"
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Selection: Story = { render: () => <PinnedToken /> };

const common = {
  weightLabel: 'Attention weight',
  valueFormat: weight,
  direction: 'source-to-destination',
  locale: 'en-US',
} as const;

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <TokenLinks title="Loading" status="loading" tokens={[]} links={[]} domain={[0, 1]} {...common} />
      <TokenLinks title="Empty" tokens={[]} links={[]} domain={[0, 1]} {...common} />
      <TokenLinks
        title="Partial"
        coverage={{ shown: 6, total: 512, unit: 'tokens' }}
        tokens={sentence.slice(0, 6)}
        links={causalHead(sentence.slice(0, 6), (index) => Math.max(0, index - 1))}
        domain={[0, 1]}
        {...common}
      />
      <TokenLinks title="Invalid" tokens={sentence} links={previousToken} domain={[0, 0.5]} {...common} />
    </ChartGrid>
  ),
};
