import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { TokenExamples } from './token-examples.tsx';
import type { TokenExample } from './token-examples.tsx';

const meta = {
  title: 'Charts/TokenExamples',
  component: TokenExamples,
  parameters: {
    docs: {
      description: {
        component:
          "The text examples that most activate a feature, each token shaded by its activation on one shared scale, with the peak token outlined and its value at the row's start. Use it for a feature's top activations or any ranked set of contexts scored per token. The application supplies the tokens, their values, the peak and the color domain.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

/** Builds a synthetic example from `|`-separated tokens and one value per token. */
function example({
  id,
  text,
  values,
  peakIndex,
  label,
}: {
  readonly id: string;
  readonly text: string;
  readonly values: ReadonlyArray<number | null>;
  readonly peakIndex?: number;
  readonly label?: string;
}): TokenExample {
  return {
    id,
    label,
    peakIndex,
    tokens: text.split('|').map((token, index) => ({ text: token, value: values[index] ?? null })),
  };
}

const activations: ReadonlyArray<TokenExample> = [
  example({
    id: 'doc-14',
    label: 'Synthetic doc 14, offset 220',
    text: 'The| ferry| leaves| for| Paris| at| noon|.',
    values: [0, 0.1, 0.2, 0.9, 4.8, 0.6, 0.1, 0],
    peakIndex: 4,
  }),
  example({
    id: 'doc-3',
    label: 'Synthetic doc 3, offset 41',
    text: 'We| landed| in| Lyon|,| then|\n|drove| on|.',
    values: [0, 0.3, 1.2, 4.1, 0.8, 0.2, 0, 0.1, 0, 0],
    peakIndex: 3,
  }),
  example({
    id: 'doc-27',
    label: 'Synthetic doc 27, offset 9',
    text: 'Flights|\tto| Nice| are| full|  today|.',
    values: [0.2, 0.7, 3.2, 0.4, 0.1, null, 0],
    peakIndex: 2,
  }),
];

const activation = { maximumFractionDigits: 2 } as const;

export const TopActivations: Story = {
  render: () => (
    <TokenExamples
      title="Feature 2048: destination cities"
      description="Synthetic activations. Each row is one context; darker tokens activate the feature more."
      locale="en-US"
      examples={activations}
      valueLabel="Activation"
      valueFormat={activation}
      domain={[0, 5]}
      palette="sequential"
      source="Synthetic feature dictionary"
    />
  ),
};

const sentence =
  'In| the| old| harbor| town|,| the| ship| from| Marseille| docked| at| dawn|,| and| the| crew| went| ashore|.';

const longExamples: ReadonlyArray<TokenExample> = [
  example({
    id: 'long-1',
    text: sentence,
    values: sentence.split('|').map((_, index) => Math.max(0, 3 - Math.abs(index - 9) * 0.8)),
    peakIndex: 9,
  }),
  example({
    id: 'long-2',
    text: sentence.replace('Marseille', 'Genoa').replace('ship', 'boat'),
    values: sentence.split('|').map((_, index) => Math.max(0, 2.4 - Math.abs(index - 9) * 0.9)),
    peakIndex: 9,
  }),
];

export const AroundThePeak: Story = {
  render: () => (
    <TokenExamples
      title="Context around each peak"
      description="Synthetic. Three tokens on each side of the peak are shown; the ellipses count the hidden ones."
      locale="en-US"
      examples={longExamples}
      valueLabel="Activation"
      valueFormat={activation}
      domain={[0, 3]}
      palette="sequential"
      context={3}
    />
  ),
};

const signed: ReadonlyArray<TokenExample> = [
  example({
    id: 'signed-1',
    text: 'The| movie| was| not| good| at| all|.',
    values: [0, 0.1, 0, -1.6, 1.2, -0.3, -0.5, 0],
  }),
  example({ id: 'signed-2', text: 'A| truly| wonderful|,| moving| film|.', values: [0, 0.6, 1.9, 0, 1.1, 0.2, 0] }),
];

export const SignedAttribution: Story = {
  render: () => (
    <TokenExamples
      title="Attribution to the positive label"
      description="Synthetic. Red tokens push against the label and blue tokens toward it; unshaded tokens are zero."
      locale="en-US"
      examples={signed}
      valueLabel="Attribution"
      valueFormat={{ maximumFractionDigits: 2, signDisplay: 'exceptZero' }}
      domain={[-2, 2]}
      palette="diverging"
    />
  ),
};

function SelectableExamples() {
  const [selected, setSelected] = useState<string | null>('doc-3');

  return (
    <TokenExamples
      title="Pick an example to inspect"
      description={`Synthetic. Press a token or use Enter to select its example. Selected: ${selected ?? 'none'}.`}
      locale="en-US"
      examples={activations}
      valueLabel="Activation"
      valueFormat={activation}
      domain={[0, 5]}
      palette="sequential"
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Selection: Story = { render: () => <SelectableExamples /> };

const states = { valueLabel: 'Activation', valueFormat: activation, palette: 'sequential', locale: 'en-US' } as const;

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <TokenExamples title="Loading" status="loading" examples={[]} domain={[0, 5]} {...states} />
      <TokenExamples title="Empty" examples={[]} domain={[0, 5]} {...states} />
      <TokenExamples
        title="Partial"
        coverage={{ shown: 2, total: 40, unit: 'examples' }}
        examples={activations.slice(0, 2)}
        domain={[0, 5]}
        {...states}
      />
      <TokenExamples title="Invalid" examples={activations} domain={[0, 2]} {...states} />
    </ChartGrid>
  ),
};
