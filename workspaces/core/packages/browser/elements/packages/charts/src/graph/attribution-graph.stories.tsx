import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { AttributionGraph } from './attribution-graph.tsx';
import type { AttributionEdge, AttributionLayer, AttributionNode } from './attribution-graph.tsx';

const meta = {
  title: 'Charts/AttributionGraph',
  component: AttributionGraph,
  parameters: {
    docs: {
      description: {
        component:
          'The graph interpretability researchers use to trace how a model computes an answer: input tokens, features in each layer and output logits, joined by signed attributions. Hue gives the sign, width the size and shape the kind of node. The application supplies the layers, the nodes in order and every edge; the graph lays them out and never infers a relationship.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const layers: ReadonlyArray<AttributionLayer> = [
  { id: 'tokens', label: 'Input tokens' },
  { id: 'l4', label: 'Layer 4' },
  { id: 'l9', label: 'Layer 9' },
  { id: 'l14', label: 'Layer 14' },
  { id: 'l20', label: 'Layer 20' },
  { id: 'logits', label: 'Output logits' },
];

const nodes: ReadonlyArray<AttributionNode> = [
  { id: 't-fact', layerId: 'tokens', label: 'Fact', kind: 'token' },
  { id: 't-capital', layerId: 'tokens', label: ' capital', kind: 'token' },
  { id: 't-state', layerId: 'tokens', label: ' state', kind: 'token' },
  { id: 't-containing', layerId: 'tokens', label: ' containing', kind: 'token' },
  { id: 't-dallas', layerId: 'tokens', label: ' Dallas', kind: 'token' },
  { id: 't-is', layerId: 'tokens', label: ' is', kind: 'token' },
  { id: 'f-capital', layerId: 'l4', label: 'capital', value: 0.71, detail: 'Fires on the word capital' },
  { id: 'f-state', layerId: 'l4', label: 'state', value: 0.52 },
  { id: 'f-dallas', layerId: 'l4', label: 'Dallas', value: 0.88, detail: 'Fires on mentions of Dallas' },
  { id: 'e-l4', layerId: 'l4', label: 'Error L4', kind: 'error', value: null },
  { id: 'f-capital-city', layerId: 'l9', label: 'capital city', value: 0.47 },
  { id: 'f-texas', layerId: 'l9', label: 'Texas', value: 0.64, detail: 'Fires on Texan places and things' },
  { id: 'e-l9', layerId: 'l9', label: 'Error L9', kind: 'error', value: null },
  { id: 'f-say-capital', layerId: 'l14', label: 'say a capital', value: 0.55 },
  { id: 'f-texas-late', layerId: 'l14', label: 'Texas, late', value: 0.39 },
  { id: 'f-say-austin', layerId: 'l20', label: 'say Austin', value: 0.81, detail: 'Promotes the token Austin' },
  { id: 'e-l20', layerId: 'l20', label: 'Error L20', kind: 'error', value: null },
  { id: 'o-austin', layerId: 'logits', label: ' Austin', kind: 'output' },
  { id: 'o-dallas', layerId: 'logits', label: ' Dallas', kind: 'output' },
];

const links: ReadonlyArray<readonly [string, string, number]> = [
  ['t-capital', 'f-capital', 0.62],
  ['t-state', 'f-state', 0.48],
  ['t-dallas', 'f-dallas', 0.81],
  ['t-containing', 'f-state', 0.12],
  ['t-fact', 'e-l4', 0.05],
  ['f-capital', 'f-capital-city', 0.44],
  ['f-state', 'f-capital-city', 0.18],
  ['f-dallas', 'f-texas', 0.57],
  ['f-state', 'f-texas', 0.15],
  ['e-l4', 'e-l9', 0.09],
  ['f-capital-city', 'f-say-capital', 0.51],
  ['f-capital', 'f-say-capital', 0.22],
  ['f-texas', 'f-texas-late', 0.34],
  ['f-texas', 'f-say-austin', 0.38],
  ['f-say-capital', 'f-say-austin', 0.46],
  ['f-texas-late', 'f-say-austin', 0.21],
  ['e-l9', 'e-l20', 0.07],
  ['f-say-austin', 'o-austin', 0.69],
  ['f-say-austin', 'o-dallas', -0.27],
  ['f-dallas', 'o-dallas', 0.24],
  ['f-say-capital', 'o-dallas', -0.19],
  ['t-is', 'o-austin', 0.08],
  ['e-l20', 'o-austin', 0.06],
  ['f-texas-late', 'o-dallas', -0.11],
];

const edges: ReadonlyArray<AttributionEdge> = links.map(([sourceId, targetId, weight]) => ({
  id: `${sourceId}>${targetId}`,
  sourceId,
  targetId,
  weight,
}));

const attribution = { maximumFractionDigits: 2 } as const;

export const TwoHopReasoning: Story = {
  render: () => (
    <AttributionGraph
      title="Attribution graph: the capital of the state containing Dallas"
      description="Synthetic graph after pruning. Inspect a node to light its inputs and outputs; press P to pin it."
      locale="en-US"
      layers={layers}
      nodes={nodes}
      edges={edges}
      weightLabel="Attribution"
      weightFormat={attribution}
      valueLabel="Activation"
      valueFormat={attribution}
      source="Synthetic cross-layer transcoder"
      transforms={['Pruned to edges above 0.05']}
    />
  ),
};

function PinnedGraph() {
  const [selected, setSelected] = useState<string | null>('f-say-austin');
  const [pinned, setPinned] = useState<ReadonlyArray<string>>(['f-dallas', 'f-texas', 'f-say-austin', 'o-austin']);
  const names = pinned.map((id) => nodes.find((node) => node.id === id)?.label ?? id);

  return (
    <div>
      <AttributionGraph
        title="A pinned subgraph"
        description="Synthetic graph. The application holds the selection and the pins; their mutual edges stay drawn."
        locale="en-US"
        layers={layers}
        nodes={nodes}
        edges={edges}
        weightLabel="Attribution"
        weightFormat={attribution}
        valueLabel="Activation"
        valueFormat={attribution}
        direction="right"
        selected={selected}
        onSelectedChange={(id) => setSelected(id)}
        pinned={pinned}
        onPinnedChange={(ids) => setPinned(ids)}
      />
      <p>{`Selected: ${selected ?? 'none'} · Pinned: ${names.length === 0 ? 'none' : names.join(', ')}`}</p>
    </div>
  );
}

export const PinnedSubgraph: Story = { render: () => <PinnedGraph /> };

const WIDE_LAYERS = 8;
const WIDE_FEATURES = 36;
const FAN_OUT = 3;

const wideLayers: ReadonlyArray<AttributionLayer> = Array.from({ length: WIDE_LAYERS }, (_, layer) => ({
  id: `w${layer}`,
  label: layer === 0 ? 'Tokens' : `Layer ${layer * 3}`,
}));

const wideNodes: ReadonlyArray<AttributionNode> = wideLayers.flatMap((layer, layerIndex) =>
  Array.from({ length: layerIndex === 0 ? 12 : WIDE_FEATURES - layerIndex * 3 }, (_, index) => ({
    id: `${layer.id}-${index}`,
    layerId: layer.id,
    label: layerIndex === 0 ? `tok ${index}` : `f${layerIndex}.${index}`,
    kind: layerIndex === 0 ? ('token' as const) : index % 9 === 8 ? ('error' as const) : ('feature' as const),
  })),
);

const wideEdges: ReadonlyArray<AttributionEdge> = wideLayers.slice(0, -1).flatMap((layer, layerIndex) => {
  const sources = wideNodes.filter((node) => node.layerId === layer.id);
  const targets = wideNodes.filter((node) => node.layerId === wideLayers[layerIndex + 1]?.id);

  return sources.flatMap((source, index) =>
    Array.from({ length: FAN_OUT }, (_, step) => {
      const target = targets[Math.round((index * targets.length) / sources.length) + step - 1];

      return target === undefined
        ? []
        : [
            {
              id: `${source.id}>${target.id}`,
              sourceId: source.id,
              targetId: target.id,
              weight: Math.round(Math.sin(index * 1.7 + step * 2.3 + layerIndex) ** 3 * 100) / 100,
            },
          ];
    }).flat(),
  );
});

export const ManyFeatures: Story = {
  render: () => (
    <AttributionGraph
      title="A wide graph scrolls inside its frame"
      description="Synthetic graph of 8 layers. The plot never zooms; arrow keys scroll the cursor into view."
      locale="en-US"
      layers={wideLayers}
      nodes={wideNodes}
      edges={wideEdges}
      weightLabel="Attribution"
      weightFormat={attribution}
    />
  ),
};

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <AttributionGraph
        title="Loading"
        locale="en-US"
        status="loading"
        layers={[]}
        nodes={[]}
        edges={[]}
        weightLabel="Attribution"
        weightFormat={attribution}
      />
      <AttributionGraph
        title="Empty"
        locale="en-US"
        layers={layers}
        nodes={[]}
        edges={[]}
        weightLabel="Attribution"
        weightFormat={attribution}
      />
      <AttributionGraph
        title="Partial"
        locale="en-US"
        coverage={{ shown: 24, total: 3810, unit: 'edges' }}
        layers={layers}
        nodes={nodes}
        edges={edges}
        weightLabel="Attribution"
        weightFormat={attribution}
        valueLabel="Activation"
        valueFormat={attribution}
      />
      <AttributionGraph
        title="Invalid"
        locale="en-US"
        layers={layers}
        nodes={nodes.slice(0, 7)}
        edges={[{ id: 'backwards', sourceId: 'f-capital', targetId: 't-capital', weight: 0.4 }]}
        weightLabel="Attribution"
        weightFormat={attribution}
        valueLabel="Activation"
        valueFormat={attribution}
      />
    </ChartGrid>
  ),
};
