import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { EmbeddingMap } from './embedding-map.tsx';
import type { EmbeddingGroup, EmbeddingLandmark, EmbeddingPoints, EmbeddingRange } from './embedding-map.tsx';

const meta = {
  title: 'Charts/EmbeddingMap',
  component: EmbeddingMap,
  parameters: {
    docs: {
      description: {
        component:
          'A map of many items the application has already projected to two dimensions, such as a UMAP of activations or embeddings, colored by group with named landmarks. It draws up to 100,000 items with canvas and up to 1,000,000 with WebGL; readers step through groups and landmarks with the arrow keys, point at any item, draw a range, and pan and zoom when exploring is on. The application supplies the coordinates, the group of each item and any sampling as `coverage`.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const clusters = [
  { id: 'syntax', label: 'Syntax', x: -6, y: 4, spread: 1.1, weight: 3 },
  { id: 'numbers', label: 'Numbers', x: 5.5, y: 5, spread: 0.8, weight: 2 },
  { id: 'code', label: 'Code', x: 7, y: -3, spread: 1.3, weight: 2 },
  { id: 'names', label: 'Names', x: -1, y: -6, spread: 0.9, weight: 1.5 },
  { id: 'negation', label: 'Negation', x: -7, y: -3.5, spread: 0.7, weight: 1 },
  { id: 'dates', label: 'Dates', x: 1, y: 1, spread: 1.6, weight: 2.5 },
] as const;

const groups: ReadonlyArray<EmbeddingGroup> = clusters.map((cluster) => ({ id: cluster.id, label: cluster.label }));

const landmarks: ReadonlyArray<EmbeddingLandmark> = clusters.map((cluster) => ({
  id: `${cluster.id}-center`,
  label: `${cluster.label} centroid`,
  x: cluster.x,
  y: cluster.y,
}));

const GOLDEN = 0.6180339887;
const PLASTIC_X = 0.7548776662;
const PLASTIC_Y = 0.569840291;
const totalWeight = clusters.reduce((sum, cluster) => sum + cluster.weight, 0);

const thresholds = clusters.map((_, index) =>
  clusters.slice(0, index + 1).reduce((sum, cluster) => sum + cluster.weight / totalWeight, 0),
);

const projections = new Map<number, EmbeddingPoints>();

function fraction(value: number): number {
  return value - Math.floor(value);
}

/** A fixed pseudo-random fraction for an index: the same input always gives the same value. */
function hash(index: number, salt: number): number {
  return fraction(Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453);
}

/** Closed-form synthetic projection: low-discrepancy sequences through a Box-Muller transform, one blob per cluster. */
function projection(count: number): EmbeddingPoints {
  const known = projections.get(count);

  if (known !== undefined) {
    return known;
  }

  const group = Array.from({ length: count }, (_, index) =>
    Math.max(
      0,
      thresholds.findIndex((threshold) => fraction(index * GOLDEN) < threshold),
    ),
  );

  const radii = Array.from({ length: count }, (_, index) =>
    Math.sqrt(-2 * Math.log(Math.max(1e-9, hash(index, PLASTIC_X)))),
  );

  const angles = Array.from({ length: count }, (_, index) => 2 * Math.PI * hash(index, PLASTIC_Y));

  const made = {
    ids: Array.from({ length: count }, (_, index) => `act-${index.toString().padStart(7, '0')}`),
    group,
    x: group.map((cluster, index) => {
      const { x, spread } = clusters[cluster] ?? clusters[0];

      return Math.round((x + spread * 1.4 * (radii[index] ?? 0) * Math.cos(angles[index] ?? 0)) * 1000) / 1000;
    }),
    y: group.map((cluster, index) => {
      const { y, spread } = clusters[cluster] ?? clusters[0];

      return Math.round((y + spread * (radii[index] ?? 0) * Math.sin(angles[index] ?? 0)) * 1000) / 1000;
    }),
  };

  projections.set(count, made);

  return made;
}

const axes = {
  x: { label: 'UMAP 1', format: { maximumFractionDigits: 2 } },
  y: { label: 'UMAP 2', format: { maximumFractionDigits: 2 } },
} as const;

export const ActivationMap: Story = {
  render: () => (
    <EmbeddingMap
      title="Layer 12 activations"
      description="Synthetic UMAP of 20,000 residual-stream activations, colored by the feature that fires most. Labels mark each cluster's centroid."
      locale="en-US"
      points={projection(20_000)}
      groups={groups}
      landmarks={landmarks}
      {...axes}
      source="Synthetic activations"
      transforms={['UMAP computed by the application (15 neighbors)']}
    />
  ),
};

function ExploreExample() {
  const [range, setRange] = useState<EmbeddingRange | null>(null);
  const [selected, setSelected] = useState<string | null>('code-center');
  const [count, setCount] = useState<number | null>(null);

  return (
    <EmbeddingMap
      title="Explore a sample"
      description={`Synthetic activations. Selected landmark: ${selected ?? 'none'}. Last range: ${count === null ? 'none' : `${count} items`}.`}
      locale="en-US"
      points={projection(50_000)}
      groups={groups}
      landmarks={landmarks}
      {...axes}
      isExplorable
      range={range}
      onRangeChange={(next, details) => {
        setRange(next);
        setCount(next === null ? null : details.count);
      }}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Explore: Story = { render: () => <ExploreExample /> };

export const LargeCanvas: Story = {
  render: () => (
    <EmbeddingMap
      title="100,000 activations on canvas"
      description="Synthetic sample of a larger run, drawn with canvas 2D. The badge states the sampling."
      locale="en-US"
      points={projection(100_000)}
      groups={groups}
      {...axes}
      renderer="canvas"
      coverage={{ shown: 100_000, total: 2_400_000, unit: 'activations' }}
      transforms={['Uniform sample of 100,000 activations']}
    />
  ),
};

export const LargeWebgl: Story = {
  render: () => (
    <EmbeddingMap
      title="1,000,000 activations with WebGL"
      description="Synthetic activations drawn with WebGL in one draw call. Without WebGL the map says so and draws with canvas."
      locale="en-US"
      points={projection(1_000_000)}
      groups={groups}
      {...axes}
      renderer="webgl"
      isExplorable
    />
  ),
};

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <EmbeddingMap
        title="Loading"
        locale="en-US"
        status="loading"
        points={{ x: [], y: [], group: [] }}
        groups={groups}
        {...axes}
        height="compact"
      />
      <EmbeddingMap
        title="Empty"
        locale="en-US"
        points={{ x: [], y: [], group: [] }}
        groups={groups}
        {...axes}
        height="compact"
      />
      <EmbeddingMap
        title="Partial"
        locale="en-US"
        points={projection(2000)}
        groups={groups}
        {...axes}
        coverage={{ shown: 2000, total: 48_000, unit: 'activations' }}
        height="compact"
      />
      <EmbeddingMap
        title="Invalid"
        locale="en-US"
        points={{ x: [0, 1], y: [0], group: [0, 0] }}
        groups={groups}
        {...axes}
        height="compact"
      />
    </ChartGrid>
  ),
};
