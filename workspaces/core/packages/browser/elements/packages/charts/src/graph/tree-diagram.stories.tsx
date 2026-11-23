import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { TreeDiagram } from './tree-diagram.tsx';
import type { TreeNode } from './tree-diagram.tsx';

const meta = {
  title: 'Charts/TreeDiagram',
  component: TreeDiagram,
  parameters: {
    docs: {
      description: {
        component:
          'A hierarchy drawn as a node-link tree: a module tree, a decision tree or a cut of a cluster dendrogram. Depth runs along one axis and leaves sit evenly in supplied order, with each parent at the middle of its children. The application supplies flat nodes with their parents and any values; the tree rejects a second root, a cycle or an unknown parent.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const LAYERS = 4;
const MILLION = 1_000_000;

const modules: ReadonlyArray<TreeNode> = [
  { id: 'model', parentId: null, label: 'Model', value: 124 * MILLION },
  { id: 'embed', parentId: 'model', label: 'Embedding', value: 38.6 * MILLION },
  { id: 'encoder', parentId: 'model', label: 'Encoder', value: 85 * MILLION },
  ...Array.from({ length: LAYERS }, (_, layer) => [
    { id: `layer-${layer}`, parentId: 'encoder', label: `Layer ${layer}`, value: 7.1 * MILLION },
    { id: `attn-${layer}`, parentId: `layer-${layer}`, label: 'Attention', value: 2.4 * MILLION },
    { id: `mlp-${layer}`, parentId: `layer-${layer}`, label: 'MLP', value: 4.7 * MILLION },
  ]).flat(),
  { id: 'norm', parentId: 'model', label: 'Final norm', value: 1536 },
  { id: 'head', parentId: 'model', label: 'Unembedding', value: null, detail: 'Tied to the embedding' },
];

const parameters = { notation: 'compact', maximumFractionDigits: 1 } as const;

export const ModuleTree: Story = {
  render: () => (
    <TreeDiagram
      title="Parameters by module"
      description="Synthetic model. The unembedding shares the embedding's weights, so it records no count of its own."
      locale="en-US"
      nodes={modules}
      valueLabel="Parameters"
      valueFormat={parameters}
      source="Synthetic checkpoint"
    />
  ),
};

const splits: ReadonlyArray<TreeNode> = [
  { id: 'root', parentId: null, label: 'Prompt length ≤ 512', value: 4000 },
  { id: 'short', parentId: 'root', label: 'Has code', value: 2600 },
  { id: 'long', parentId: 'root', label: 'Retrieval used', value: 1400 },
  { id: 'short-code', parentId: 'short', label: 'Pass', value: 900, tone: 'positive' },
  { id: 'short-text', parentId: 'short', label: 'Toxicity ≤ 0.2', value: 1700 },
  { id: 'text-clean', parentId: 'short-text', label: 'Pass', value: 1500, tone: 'positive' },
  { id: 'text-toxic', parentId: 'short-text', label: 'Fail', value: 200, tone: 'negative' },
  { id: 'long-rag', parentId: 'long', label: 'Pass', value: 1100, tone: 'positive' },
  { id: 'long-plain', parentId: 'long', label: 'Fail', value: 300, tone: 'negative' },
];

function DecisionTree() {
  const [selected, setSelected] = useState<string | null>('text-toxic');

  return (
    <div>
      <TreeDiagram
        title="Evaluation outcome by prompt features"
        description="Synthetic decision tree over 4,000 graded prompts. Leaves are outcomes; values are prompt counts."
        locale="en-US"
        nodes={splits}
        direction="down"
        link="curve"
        valueLabel="Prompts"
        valueFormat={{ maximumFractionDigits: 0 }}
        toneLegend={[
          { id: 'pass', label: 'Pass', tone: 'positive' },
          { id: 'fail', label: 'Fail', tone: 'negative' },
          { id: 'split', label: 'Split', tone: 'neutral' },
        ]}
        selected={selected}
        onSelectedChange={(id) => setSelected(id)}
      />
      <p>{`Selected: ${selected ?? 'none'}`}</p>
    </div>
  );
}

export const SelectableDecisionTree: Story = { render: () => <DecisionTree /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <TreeDiagram title="Loading" locale="en-US" status="loading" nodes={[]} />
      <TreeDiagram title="Empty" locale="en-US" nodes={[]} />
      <TreeDiagram
        title="Partial"
        locale="en-US"
        coverage={{ shown: 9, total: 212, unit: 'modules' }}
        nodes={splits.map(({ value: _value, ...node }) => node)}
      />
      <TreeDiagram
        title="Invalid"
        locale="en-US"
        nodes={[
          { id: 'a', parentId: null, label: 'Encoder' },
          { id: 'b', parentId: null, label: 'Decoder' },
        ]}
      />
    </ChartGrid>
  ),
};
