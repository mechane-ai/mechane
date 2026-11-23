import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack } from '../../../core/src/index.ts';
import { CorrelationMatrix } from './correlation-matrix.tsx';
import type { MatrixCellRange } from './matrix-types.ts';

const meta = {
  title: 'Charts/CorrelationMatrix',
  component: CorrelationMatrix,
  parameters: {
    docs: {
      description: {
        component:
          'Pairwise correlation coefficients between variables on a diverging palette fixed at -1 to 1, with the diagonal in gray as context. Use it to compare how evaluation metrics, probes or features move together; triangle="lower" shows each pair once. The application computes the coefficients and supplies a symmetric table; asymmetric or out-of-range input is refused.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const metrics = [
  { id: 'mmlu', label: 'MMLU' },
  { id: 'gsm8k', label: 'GSM8K' },
  { id: 'humaneval', label: 'HumanEval' },
  { id: 'truthfulqa', label: 'TruthfulQA' },
  { id: 'toxicity', label: 'Toxicity' },
  { id: 'latency', label: 'Latency' },
];

const coefficients: ReadonlyArray<ReadonlyArray<number | null>> = [
  [1, 0.82, 0.67, 0.41, -0.18, 0.12],
  [0.82, 1, 0.74, 0.33, -0.22, 0.2],
  [0.67, 0.74, 1, 0.29, -0.09, null],
  [0.41, 0.33, 0.29, 1, -0.57, -0.04],
  [-0.18, -0.22, -0.09, -0.57, 1, 0.03],
  [0.12, 0.2, null, -0.04, 0.03, 1],
];

export const Default: Story = {
  render: () => (
    <CorrelationMatrix
      title="How benchmark scores move together"
      description="Synthetic Pearson correlations across 40 checkpoints. HumanEval and latency were not measured on the same checkpoints, so that pair is missing."
      locale="en-US"
      variables={metrics}
      coefficients={coefficients}
      valueLabel="Pearson correlation"
      source="Synthetic checkpoint sweep"
    />
  ),
};

function LowerTriangle(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);
  const [cellRange, setCellRange] = useState<MatrixCellRange | null>(null);

  return (
    <CorrelationMatrix
      title="Each pair once"
      description="The same synthetic correlations below the diagonal. Select a pair, or mark a block with Shift and the arrow keys to copy it."
      locale="en-US"
      variables={metrics}
      coefficients={coefficients}
      triangle="lower"
      selected={selected}
      onSelectedChange={setSelected}
      cellRange={cellRange}
      onCellRangeChange={setCellRange}
    />
  );
}

export const Lower: Story = { render: () => <LowerTriangle /> };

const probes = [
  { id: 'syntax', label: 'Syntax probe' },
  { id: 'sentiment', label: 'Sentiment probe' },
];

export const States: Story = {
  render: () => (
    <Stack>
      <CorrelationMatrix title="Probe agreement" locale="en-US" variables={probes} coefficients={[]} status="loading" />
      <CorrelationMatrix title="Probe agreement" locale="en-US" variables={[]} coefficients={[]} />
      <CorrelationMatrix
        title="Probe agreement, sampled"
        locale="en-US"
        variables={probes}
        coefficients={[
          [1, 0.38],
          [0.38, 1],
        ]}
        coverage={{ shown: 512, total: 8192, unit: 'activations' }}
      />
      <CorrelationMatrix
        title="Probe agreement, asymmetric"
        description="0.38 one way and 0.41 the other cannot both be the correlation of the same pair."
        locale="en-US"
        variables={probes}
        coefficients={[
          [1, 0.38],
          [0.41, 1],
        ]}
      />
    </Stack>
  ),
};
