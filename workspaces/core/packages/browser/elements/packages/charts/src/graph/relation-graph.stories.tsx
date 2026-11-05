import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel } from '../../../core/src/index.ts';
import { RelationGraph } from './relation-graph.tsx';
import type { RelationEdge, RelationGroup, RelationNode } from './relation-graph.tsx';

const meta = {
  title: 'Charts/Relation graph',
  component: RelationGraph,
  parameters: {
    docs: {
      description: {
        component:
          'RelationGraph renders a supplied layout and supplied relationships. It does not infer edges from proximity, run a layout algorithm, or expose editing commands. Node selection uses native buttons. The labelled scrolling region preserves node sizes on narrow screens. Group membership is explicit. Graph data preserves full node labels, descriptions, groups, and directed or undirected relationships as text, including isolated nodes. Node, edge, and group identifiers must be unique; references and geometry must be valid. The bounded view accepts up to 256 nodes, 1,024 edges, and 256 groups on a canvas no larger than 8,192 pixels per side. Supply a labelled neighborhood for larger analyses.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const nodes: ReadonlyArray<RelationNode> = [
  {
    id: 'base',
    label: 'Base checkpoint',
    description: 'Initial parameters',
    x: 24,
    y: 140,
    width: 160,
    height: 72,
    tone: 'neutral',
  },
  {
    id: 'train-a',
    label: 'Training run A',
    description: 'Saved at step 1,200',
    x: 260,
    y: 80,
    width: 176,
    height: 72,
    tone: 'series1',
  },
  {
    id: 'train-b',
    label: 'Training run B',
    description: 'Saved at step 2,400',
    x: 260,
    y: 220,
    width: 176,
    height: 72,
    tone: 'series2',
  },
  {
    id: 'eval-a',
    label: 'Evaluation A',
    description: 'Prepared reference scores',
    x: 532,
    y: 80,
    width: 192,
    height: 72,
    tone: 'series1',
  },
  {
    id: 'eval-b',
    label: 'Evaluation B',
    description: 'Prepared reference scores',
    x: 532,
    y: 220,
    width: 192,
    height: 72,
    tone: 'series2',
  },
];

const edges: ReadonlyArray<RelationEdge> = [
  { id: 'base-a', sourceId: 'base', targetId: 'train-a', label: 'Initialized from checkpoint', direction: 'directed' },
  { id: 'base-b', sourceId: 'base', targetId: 'train-b', label: 'Initialized from checkpoint', direction: 'directed' },
  { id: 'a-eval', sourceId: 'train-a', targetId: 'eval-a', label: 'Evaluated checkpoint', direction: 'directed' },
  { id: 'b-eval', sourceId: 'train-b', targetId: 'eval-b', label: 'Evaluated checkpoint', direction: 'directed' },
];

const groups: ReadonlyArray<RelationGroup> = [
  {
    id: 'experiment',
    label: 'Experiment comparison',
    x: 232,
    y: 32,
    width: 520,
    height: 292,
    nodeIds: ['train-a', 'train-b', 'eval-a', 'eval-b'],
  },
];

function Lineage(): ReactNode {
  const [selectedId, setSelectedId] = useState<string>();

  return (
    <Panel>
      <RelationGraph
        title="Checkpoint lineage"
        description="Five synthetic artifacts with recorded initialization and evaluation relationships. Positions are supplied by the application."
        nodes={nodes}
        edges={edges}
        groups={groups}
        width={784}
        height={356}
        selection={{ selectedId, onSelect: setSelectedId }}
        emptyLabel="No related artifacts were supplied."
      />
    </Panel>
  );
}

export const CheckpointLineage: Story = { render: () => <Lineage /> };

export const IsolatedNode: Story = {
  render: () => (
    <RelationGraph
      title="Observed feature"
      description="An isolated record has no inferred relationships."
      nodes={[
        {
          id: 'feature',
          label: 'Feature 392',
          description: 'No supplied relationships',
          x: 24,
          y: 24,
          width: 200,
          height: 72,
          tone: 'series3',
        },
      ]}
      edges={[]}
      width={260}
      height={128}
      emptyLabel="No features were supplied."
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <RelationGraph
      title="Checkpoint lineage"
      description="No records have been supplied."
      nodes={[]}
      edges={[]}
      width={640}
      height={260}
      emptyLabel="No related artifacts were supplied."
    />
  ),
};

export const InvalidRelationship: Story = {
  render: () => (
    <RelationGraph
      title="Invalid lineage input"
      description="Missing nodes produce an error rather than a partial graph."
      nodes={nodes}
      edges={[
        ...edges,
        { id: 'missing', sourceId: 'base', targetId: 'unknown', label: 'Unavailable endpoint', direction: 'directed' },
      ]}
      width={784}
      height={356}
      emptyLabel="No related artifacts were supplied."
    />
  ),
};

export const Narrow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => <Lineage />,
};

function LongNodeLabel(): ReactNode {
  const [selectedId, onSelect] = useState<string>();

  return (
    <RelationGraph
      title="Full records in compact node boxes"
      description="Synthetic isolated nodes keep the supplied size. Graph data retains each full label and description."
      nodes={[
        {
          id: 'compact',
          label: 'Checkpoint from the complete validation and review sequence',
          description:
            'The supplied 44-pixel box has room for one label. This complete description stays available in Graph data and selection.',
          x: 24,
          y: 24,
          width: 176,
          height: 44,
          tone: 'series1',
        },
        {
          id: 'detail',
          label: 'Independent checkpoint with an extended display name',
          description: 'Prepared measurements from the full held-out evaluation window',
          x: 24,
          y: 96,
          width: 240,
          height: 72,
          tone: 'series2',
        },
      ]}
      edges={[]}
      width={288}
      height={192}
      selection={{ selectedId, onSelect }}
      emptyLabel="No records were supplied."
    />
  );
}

export const LongLabels: Story = { render: () => <LongNodeLabel /> };
