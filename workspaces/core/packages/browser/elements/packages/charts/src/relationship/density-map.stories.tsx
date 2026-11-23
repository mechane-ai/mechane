import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartGrid } from '../chart-grid.tsx';
import { DensityMap } from './density-map.tsx';
import type { DensityHistogram } from './density-map.tsx';

const meta = {
  title: 'Charts/DensityMap',
  component: DensityMap,
  parameters: {
    docs: {
      description: {
        component:
          'A 2D histogram as a grid of cells, darker where more items fall, for joint distributions too large to draw as points. It draws up to 512 by 512 cells on canvas and states the exact count and bounds of the cell under the pointer or keyboard cursor. The application bins the data and supplies the counts, the grid size and both domains.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

type Bump = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly mass: number;
};

/** Closed-form synthetic counts: a sum of Gaussian bumps evaluated at each cell's center, rounded to whole items. */
function histogram({
  columns,
  rows,
  bumps,
}: {
  readonly columns: number;
  readonly rows: number;
  readonly bumps: ReadonlyArray<Bump>;
}): DensityHistogram {
  const counts = Array.from({ length: columns * rows }, (_, index) => {
    const across = ((index % columns) + 0.5) / columns;
    const up = (Math.floor(index / columns) + 0.5) / rows;

    const value = bumps
      .map(
        (bump) => bump.mass * Math.exp(-(((across - bump.x) / bump.width) ** 2 + ((up - bump.y) / bump.height) ** 2)),
      )
      .reduce((sum, part) => sum + part, 0);

    return Math.floor(value);
  });

  return { columns, rows, counts, xDomain: [0, 1], yDomain: [0, 1] };
}

const features: ReadonlyArray<Bump> = [
  { x: 0.2, y: 0.25, width: 0.12, height: 0.15, mass: 180 },
  { x: 0.65, y: 0.7, width: 0.2, height: 0.1, mass: 120 },
  { x: 0.8, y: 0.2, width: 0.06, height: 0.06, mass: 60 },
];

const unit = { label: 'Feature activation', format: { maximumFractionDigits: 2 } } as const;
const tokens = { label: 'Tokens', format: { maximumFractionDigits: 0 } } as const;

export const FeatureActivations: Story = {
  render: () => (
    <DensityMap
      title="Two features fire together"
      description="Synthetic counts of tokens by the activation of two sparse-autoencoder features. Darker cells hold more tokens."
      locale="en-US"
      histogram={histogram({ columns: 40, rows: 24, bumps: features })}
      x={{ label: 'Feature 1184 activation', format: unit.format }}
      y={{ label: 'Feature 2071 activation', format: unit.format }}
      count={tokens}
      source="Synthetic tokens"
      transforms={['Binned by the application into 40 by 24 cells']}
    />
  ),
};

const PAYLOAD_DECADES = 4;

const latency = histogram({
  columns: 64,
  rows: 48,
  bumps: [
    { x: 0.3, y: 0.2, width: 0.15, height: 0.08, mass: 900 },
    { x: 0.75, y: 0.55, width: 0.12, height: 0.18, mass: 300 },
  ],
});

export const LogAxis: Story = {
  render: () => (
    <DensityMap
      title="Latency by payload size"
      description="Synthetic requests. Payload bins are even on a log scale, so the cells are too. Beyond 1,024 filled cells the arrow keys step through rows."
      locale="en-US"
      histogram={{ ...latency, xDomain: [100, 100 * 10 ** PAYLOAD_DECADES], yDomain: [0, 800] }}
      x={{ label: 'Payload (bytes)', scale: 'log', format: { maximumFractionDigits: 0 } }}
      y={{ label: 'Latency (ms)', format: { maximumFractionDigits: 0 } }}
      count={{ label: 'Requests', format: { maximumFractionDigits: 0 } }}
    />
  ),
};

export const Largest: Story = {
  render: () => (
    <DensityMap
      title="512 by 512 cells"
      description="Synthetic counts at the largest grid the map draws, one canvas image."
      locale="en-US"
      histogram={histogram({ columns: 512, rows: 512, bumps: features })}
      x={{ label: 'Feature 1184 activation', format: unit.format }}
      y={{ label: 'Feature 2071 activation', format: unit.format }}
      count={tokens}
    />
  ),
};

const small = histogram({ columns: 12, rows: 8, bumps: features });

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <DensityMap
        title="Loading"
        locale="en-US"
        status="loading"
        histogram={small}
        x={{ label: 'Feature 1184', format: unit.format }}
        y={{ label: 'Feature 2071', format: unit.format }}
        count={tokens}
        height="compact"
      />
      <DensityMap
        title="Empty"
        locale="en-US"
        histogram={{ ...small, counts: small.counts.map(() => 0) }}
        x={{ label: 'Feature 1184', format: unit.format }}
        y={{ label: 'Feature 2071', format: unit.format }}
        count={tokens}
        height="compact"
      />
      <DensityMap
        title="Partial"
        locale="en-US"
        histogram={small}
        x={{ label: 'Feature 1184', format: unit.format }}
        y={{ label: 'Feature 2071', format: unit.format }}
        count={tokens}
        coverage={{ shown: 40_000, total: 1_200_000, unit: 'tokens' }}
        height="compact"
      />
      <DensityMap
        title="Invalid"
        locale="en-US"
        histogram={{ ...small, counts: small.counts.slice(1) }}
        x={{ label: 'Feature 1184', format: unit.format }}
        y={{ label: 'Feature 2071', format: unit.format }}
        count={tokens}
        height="compact"
      />
    </ChartGrid>
  ),
};
