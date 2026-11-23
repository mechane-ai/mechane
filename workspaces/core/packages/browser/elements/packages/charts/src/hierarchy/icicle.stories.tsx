import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack, Text } from '../../../core/src/index.ts';
import { Icicle } from './icicle.tsx';
import type { IcicleNode } from './icicle.tsx';

const meta = {
  title: 'Charts/Icicle',
  component: Icicle,
  parameters: {
    docs: {
      description: {
        component:
          'Icicle draws a hierarchy as stacked bands, one row per level, with each node as wide as its share of its parent. Use it for nested totals such as parameters by module or time by stage. The application supplies every node with its own total; a parent larger than its children leaves the rest empty, and a parent smaller than its children is rejected.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const parameters = { notation: 'compact', maximumFractionDigits: 1 } as const;

/** Synthetic parameter counts for a small decoder-only language model. */
const model: ReadonlyArray<IcicleNode> = [
  { id: 'model', parentId: null, label: 'Model', value: 1.42e9 },
  { id: 'embedding', parentId: 'model', label: 'Embedding', value: 1.03e8 },
  { id: 'decoder', parentId: 'model', label: 'Decoder blocks', value: 1.21e9 },
  { id: 'head', parentId: 'model', label: 'Output head', value: 1.03e8 },
  { id: 'attention', parentId: 'decoder', label: 'Attention', value: 4.03e8 },
  { id: 'mlp', parentId: 'decoder', label: 'MLP', value: 8.05e8 },
  { id: 'norms', parentId: 'decoder', label: 'Norms', value: 1.6e6 },
  { id: 'qkv', parentId: 'attention', label: 'Query, key, value', value: 3.02e8 },
  { id: 'out-proj', parentId: 'attention', label: 'Output projection', value: 1.01e8 },
  { id: 'up', parentId: 'mlp', label: 'Up projection', value: 4.03e8 },
  { id: 'down', parentId: 'mlp', label: 'Down projection', value: 4.02e8 },
];

function ParameterBreakdown(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);
  const node = model.find((candidate) => candidate.id === selected);

  return (
    <Stack>
      <Icicle
        title="Parameters by module"
        locale="en-US"
        description="Synthetic counts for a 1.4 billion parameter decoder. Each band is one level of the module tree."
        nodes={model}
        valueFormat={parameters}
        selected={selected}
        onSelectedChange={setSelected}
      />
      <Text>{node === undefined ? 'Select a module to open its details.' : `Selected module: ${node.label}`}</Text>
    </Stack>
  );
}

export const ParametersByModule: Story = { render: () => <ParameterBreakdown /> };

const seconds = { style: 'unit', unit: 'second', maximumFractionDigits: 1 } as const;

/** Synthetic wall-clock time of one evaluation run; the run total includes untracked overhead. */
const run: ReadonlyArray<IcicleNode> = [
  { id: 'run', parentId: null, label: 'Evaluation run', value: 412 },
  { id: 'setup', parentId: 'run', label: 'Setup', value: 38 },
  { id: 'inference', parentId: 'run', label: 'Inference', value: 301 },
  { id: 'scoring', parentId: 'run', label: 'Scoring', value: 54 },
  { id: 'load', parentId: 'setup', label: 'Load weights', value: 31 },
  { id: 'warmup', parentId: 'setup', label: 'Warm-up', value: 6.5 },
  { id: 'prefill', parentId: 'inference', label: 'Prefill', value: 88 },
  { id: 'decode', parentId: 'inference', label: 'Decode', value: 209 },
  { id: 'judge', parentId: 'scoring', label: 'Model judge', value: null },
  { id: 'exact', parentId: 'scoring', label: 'Exact match', value: 3.2 },
];

export const TimeByStage: Story = {
  render: () => (
    <Icicle
      title="Time by stage"
      locale="en-US"
      description="Synthetic timings. Stages do not add up to the run: the gaps are untracked time. The judge step was not timed."
      nodes={run}
      valueFormat={seconds}
      height="compact"
    />
  ),
};

export const States: Story = {
  render: () => (
    <Stack>
      <Icicle title="Loading parameters" locale="en-US" status="loading" nodes={[]} valueFormat={parameters} />
      <Icicle title="No modules" locale="en-US" nodes={[]} valueFormat={parameters} />
      <Icicle
        title="Parameters of the first two levels"
        locale="en-US"
        coverage={{ shown: 7, total: 11, unit: 'modules' }}
        nodes={model.slice(0, 7)}
        valueFormat={parameters}
        height="compact"
      />
      <Icicle
        title="Inconsistent totals"
        locale="en-US"
        nodes={[
          { id: 'run', parentId: null, label: 'Run', value: 10 },
          { id: 'a', parentId: 'run', label: 'Stage A', value: 8 },
          { id: 'b', parentId: 'run', label: 'Stage B', value: 6 },
        ]}
        valueFormat={seconds}
      />
    </Stack>
  ),
};
