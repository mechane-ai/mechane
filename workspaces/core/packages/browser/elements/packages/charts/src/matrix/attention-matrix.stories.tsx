import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack } from '../../../core/src/index.ts';
import { ChartGrid } from '../chart-grid.tsx';
import { AttentionMatrix } from './attention-matrix.tsx';
import type { AttentionToken } from './attention-matrix.tsx';
import type { MatrixCellRange } from './matrix-types.ts';

const meta = {
  title: 'Charts/AttentionMatrix',
  component: AttentionMatrix,
  parameters: {
    docs: {
      description: {
        component:
          'One attention head with destinations, the tokens that attend, down the rows and sources, the tokens attended to, across the columns, with weights in [0, 1] as lightness of one hue. Token text stays exact with visible whitespace, inspection names both tokens and their positions, and a causal mask draws masked pairs hollow, apart from zero. `cellValues="hidden"` draws small color-only panels for comparing heads, and a `ChartLink` around them shares the inspected pair. The application supplies the weights; attention alone is not a causal explanation.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const tokens: ReadonlyArray<AttentionToken> = ['The', ' cat', ' sat', ' on', ' the', ' mat', '.\n'].map(
  (text, index) => ({ id: `t${index}`, index: index + 12, text }),
);

/** Each destination row spreads its attention over the sources at or before it, decaying with distance at `rate`. */
function pattern(rate: number): ReadonlyArray<ReadonlyArray<number | null>> {
  const decay = Math.exp(-rate);

  return tokens.map((_, row) =>
    tokens.map((__, column) => {
      if (column > row) {
        return null;
      }

      const total = (1 - decay ** (row + 1)) / (1 - decay);

      return Math.round((1000 * decay ** (row - column)) / total) / 1000;
    }),
  );
}

const weights = pattern(1 / 2);

export const Causal: Story = {
  render: () => (
    <AttentionMatrix
      title="Layer 4, head 7"
      description="Synthetic weights for a seven-token window starting at position 12. Each row sums to one over the sources its token may see."
      locale="en-US"
      sources={tokens}
      destinations={tokens}
      weights={weights}
      mask="causal"
      source="Synthetic"
    />
  ),
};

function Inspect(): ReactNode {
  const [selected, setSelected] = useState<string | null>(JSON.stringify(['t5', 't1']));
  const [cellRange, setCellRange] = useState<MatrixCellRange | null>(null);

  return (
    <AttentionMatrix
      title="Select a pair"
      description="The selected pair stays marked while you inspect others. Shift with the arrow keys marks a block to copy."
      locale="en-US"
      sources={tokens}
      destinations={tokens}
      weights={weights}
      mask="causal"
      valueLabel="Attention weight, layer 4 head 7"
      selected={selected}
      onSelectedChange={setSelected}
      cellRange={cellRange}
      onCellRangeChange={setCellRange}
    />
  );
}

export const Interactive: Story = { render: () => <Inspect /> };

const heads = [
  { id: 'h0', label: 'Head 0, local', rate: 2 },
  { id: 'h1', label: 'Head 1, recent', rate: 1 / 2 },
  { id: 'h2', label: 'Head 2, broad', rate: 1 / 8 },
] as const;

/** Small color-only panels in one link: inspecting a pair in one head marks the same pair in the others. */
export const SmallMultiples: Story = {
  render: () => (
    <ChartGrid
      title="Three heads, layer 4"
      description="Synthetic. Point at a pair in one head to mark it in all three."
      minPanelWidth={240}
    >
      {heads.map((head) => (
        <AttentionMatrix
          key={head.id}
          title={head.label}
          locale="en-US"
          sources={tokens}
          destinations={tokens}
          weights={pattern(head.rate)}
          mask="causal"
          cellValues="hidden"
        />
      ))}
    </ChartGrid>
  ),
};

const pair = tokens.slice(0, 2);

export const States: Story = {
  render: () => (
    <Stack>
      <AttentionMatrix title="Head 0" locale="en-US" sources={pair} destinations={pair} weights={[]} status="loading" />
      <AttentionMatrix title="Head 0" locale="en-US" sources={[]} destinations={[]} weights={[]} />
      <AttentionMatrix
        title="Head 0, first tokens"
        locale="en-US"
        sources={pair}
        destinations={pair}
        weights={[
          [1, null],
          [0.31, 0.69],
        ]}
        mask="causal"
        coverage={{ shown: 2, total: 512, unit: 'tokens' }}
      />
      <AttentionMatrix
        title="Head 0, weight under the mask"
        description="A weight of 0 at a masked pair would read as measured, so the chart refuses it."
        locale="en-US"
        sources={pair}
        destinations={pair}
        weights={[
          [1, 0],
          [0.31, 0.69],
        ]}
        mask="causal"
      />
    </Stack>
  ),
};
