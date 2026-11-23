import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { TokenPredictions } from './token-predictions.tsx';
import type { TokenPrediction } from './token-predictions.tsx';

const meta = {
  title: 'Charts/TokenPredictions',
  component: TokenPredictions,
  parameters: {
    docs: {
      description: {
        component:
          'What a model predicts next, as token chips with bars from zero in supplied order. Optional baseline ticks compare the distribution with another condition, such as before steering, and the readout gives the signed change. The application supplies every token, probability, baseline and the target flag.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const nextToken: ReadonlyArray<TokenPrediction> = [
  { id: 'paris', token: ' Paris', probability: 0.71, isTarget: true },
  { id: 'the', token: ' the', probability: 0.09 },
  { id: 'lyon', token: ' Lyon', probability: 0.06 },
  { id: 'a', token: ' a', probability: 0.04 },
  { id: 'newline', token: '\n', probability: 0.02 },
  { id: 'france', token: ' France', probability: null },
];

export const NextToken: Story = {
  render: () => (
    <TokenPredictions
      title="Next token after “The capital of France is”"
      description="Synthetic logits after softmax. The probability of ' France' was not recorded."
      locale="en-US"
      predictions={nextToken}
      domain={[0, 1]}
      source="Synthetic model, final layer"
    />
  ),
};

const steered: ReadonlyArray<TokenPrediction> = [
  { id: 'bridge', token: ' bridge', probability: 0.48, baseline: 0.03 },
  { id: 'paris', token: ' Paris', probability: 0.22, baseline: 0.71, isTarget: true },
  { id: 'golden', token: ' Golden', probability: 0.11, baseline: 0.01 },
  { id: 'the', token: ' the', probability: 0.07, baseline: 0.09 },
  { id: 'lyon', token: ' Lyon', probability: 0.02, baseline: 0.06 },
];

export const Steering: Story = {
  render: () => (
    <TokenPredictions
      title="Steering with feature 512"
      description="Synthetic. Bars are probabilities after steering; ticks are the same tokens before steering."
      locale="en-US"
      predictions={steered}
      domain={[0, 1]}
      baselineLabel="Before steering"
      transforms={['Feature 512 clamped to 8× its maximum']}
    />
  ),
};

function SelectablePredictions() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <TokenPredictions
      title="Pick a token to continue with"
      description={`Synthetic. Press a row or use Enter to select it. Selected: ${selected ?? 'none'}.`}
      locale="en-US"
      predictions={nextToken.slice(0, 4)}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Selection: Story = { render: () => <SelectablePredictions /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <TokenPredictions title="Loading" locale="en-US" status="loading" predictions={[]} />
      <TokenPredictions title="Empty" locale="en-US" predictions={[]} />
      <TokenPredictions
        title="Partial"
        locale="en-US"
        coverage={{ shown: 3, total: 50_257, unit: 'tokens' }}
        predictions={nextToken.slice(0, 3)}
        domain={[0, 1]}
      />
      <TokenPredictions title="Invalid" locale="en-US" predictions={nextToken} domain={[0, 0.5]} />
    </ChartGrid>
  ),
};
