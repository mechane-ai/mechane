import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { TokenGrid, tokenGridCellId } from './token-grid.tsx';
import type { TokenGridCell, TokenGridColumn, TokenGridRow } from './token-grid.tsx';

const meta = {
  title: 'Charts/TokenGrid',
  component: TokenGrid,
  parameters: {
    docs: {
      description: {
        component:
          'The logit-lens table: one row per layer or stage, one column per prompt position, and in each cell the predicted token with its value as a shade. Use it to follow how a prediction forms through a model. The application supplies the prompt, the stages, each cell’s token and value, and the color domain.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const prompt: ReadonlyArray<TokenGridColumn> = [
  { id: 'p0', token: 'The' },
  { id: 'p1', token: ' Eiffel' },
  { id: 'p2', token: ' Tower' },
  { id: 'p3', token: ' is' },
  { id: 'p4', token: ' in' },
];

const layers: ReadonlyArray<TokenGridRow> = [0, 4, 8, 12, 16, 20].map((layer) => ({
  id: `layer-${layer}`,
  label: `Layer ${layer}`,
}));

/** Per position, the synthetic top prediction at each layer, from the first layer to the last. */
const predictions: Readonly<Record<string, ReadonlyArray<string>>> = {
  p0: ['The', ' first', ' same', ' same', '\n', '\n'],
  p1: [' Eiffel', ' Eiffel', ' Tower', ' Tower', ' Tower', ' Tower'],
  p2: [' Tower', ' tower', ' is', ' is', ',', ' is'],
  p3: [' is', ' a', ' located', ' in', ' located', ' located'],
  p4: [' in', ' the', ' France', ' Paris', ' Paris', ' Paris'],
};

const cells: ReadonlyArray<TokenGridCell> = prompt.flatMap((column, position) =>
  layers.flatMap((row, depth) => {
    if (position === 2 && depth === 1) {
      return [];
    }

    return [
      {
        rowId: row.id,
        columnId: column.id,
        token: predictions[column.id]?.[depth] ?? null,
        value: position === 3 && depth === 2 ? null : Math.min(0.95, 0.05 + 0.15 * depth + 0.04 * position),
      },
    ];
  }),
);

const probability = { style: 'percent', maximumFractionDigits: 0 } as const;

export const LogitLens: Story = {
  render: () => (
    <TokenGrid
      title="Logit lens on “The Eiffel Tower is in”"
      description="Synthetic. Each cell is the top token decoded from that layer's residual stream at that position."
      locale="en-US"
      columns={prompt}
      rows={layers}
      cells={cells}
      valueLabel="Probability"
      valueFormat={probability}
      domain={[0, 1]}
      palette="sequential"
      source="Synthetic 24-layer model"
    />
  ),
};

const words = ['The', ' quick', ' brown', ' fox', ' jumps', ' over', ' the', ' lazy', ' dog', '.'];

const longPrompt = Array.from({ length: 40 }, (_, index) => ({
  id: `t${index}`,
  token: words[index % words.length] ?? '',
}));

const fewLayers = layers.slice(2);

const longCells: ReadonlyArray<TokenGridCell> = longPrompt.flatMap((column, position) =>
  fewLayers.map((row, depth) => ({
    rowId: row.id,
    columnId: column.id,
    token: words[(position + 1) % words.length] ?? null,
    value: Math.round(45 * Math.sin(position * 0.7 + depth)) / 100,
  })),
);

export const LongPrompt: Story = {
  render: () => (
    <TokenGrid
      title="Change in log-probability across a long prompt"
      description="Synthetic signed values. The grid scrolls inside its frame; layer labels and the prompt stay in view."
      locale="en-US"
      columns={longPrompt}
      rows={fewLayers}
      cells={longCells}
      valueLabel="Change in log-probability"
      valueFormat={{ maximumFractionDigits: 2, signDisplay: 'exceptZero' }}
      domain={[-0.5, 0.5]}
      palette="diverging"
    />
  ),
};

function SelectableGrid() {
  const [selected, setSelected] = useState<string | null>(tokenGridCellId('layer-12', 'p4'));

  return (
    <TokenGrid
      title="Pick a cell to trace"
      description={`Synthetic. Press a cell or use Enter to select it. Selected: ${selected ?? 'none'}.`}
      locale="en-US"
      columns={prompt}
      rows={layers}
      cells={cells}
      valueLabel="Probability"
      valueFormat={probability}
      domain={[0, 1]}
      palette="sequential"
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Selection: Story = { render: () => <SelectableGrid /> };

const shared = { valueLabel: 'Probability', valueFormat: probability, palette: 'sequential', locale: 'en-US' } as const;

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <TokenGrid title="Loading" status="loading" columns={[]} rows={[]} cells={[]} domain={[0, 1]} {...shared} />
      <TokenGrid title="Empty" columns={[]} rows={[]} cells={[]} domain={[0, 1]} {...shared} />
      <TokenGrid
        title="Partial"
        coverage={{ shown: 6, total: 24, unit: 'layers' }}
        columns={prompt}
        rows={layers}
        cells={cells}
        domain={[0, 1]}
        {...shared}
      />
      <TokenGrid title="Invalid" columns={prompt} rows={layers} cells={cells} domain={[0, 0.5]} {...shared} />
    </ChartGrid>
  ),
};
