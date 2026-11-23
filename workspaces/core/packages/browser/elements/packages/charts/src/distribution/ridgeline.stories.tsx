import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartGrid } from '../chart-grid.tsx';
import type { DensityPoint } from './group-plot-input.ts';
import { Ridgeline } from './ridgeline.tsx';
import type { RidgeRow } from './ridgeline.tsx';

const meta = {
  title: 'Charts/Ridgeline',
  component: Ridgeline,
  parameters: {
    docs: {
      description: {
        component:
          'Densities of many groups as overlapping ridges down the page, with one value axis at the bottom. All ridges share one density scale, and later rows are drawn on top. Use it for a distribution per layer, checkpoint or cohort. The application computes every density; the stories use synthetic curves.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const POINTS = 61;
const DOMAIN_SPAN = 6;
const SQRT_TAU = Math.sqrt(2 * Math.PI);

function activations({
  mean,
  spread,
}: {
  readonly mean: number;
  readonly spread: number;
}): ReadonlyArray<DensityPoint> {
  return Array.from({ length: POINTS }, (_, index) => {
    const value = -DOMAIN_SPAN / 2 + (index * DOMAIN_SPAN) / (POINTS - 1);

    return { value, density: Math.exp(-0.5 * ((value - mean) / spread) ** 2) / (spread * SQRT_TAU) };
  });
}

const layers: ReadonlyArray<RidgeRow> = Array.from({ length: 10 }, (_, layer) => ({
  id: `layer-${layer}`,
  label: `Layer ${layer}`,
  density: activations({ mean: -1 + 0.25 * layer, spread: 1.1 - 0.07 * layer }),
}));

const axis = { label: 'Activation', domain: [-3, 3], format: { maximumFractionDigits: 1 } } as const;

export const ActivationsByLayer: Story = {
  render: () => (
    <Ridgeline
      title="Activation distribution by layer"
      description="Synthetic activations. The distributions drift right and narrow with depth."
      locale="en-US"
      rows={layers}
      value={axis}
      densityLabel="density of activations"
      source="Synthetic probe"
      height="tall"
    />
  ),
};

export const TightOverlap: Story = {
  render: () => (
    <Ridgeline
      title="Same layers, ridges kept apart"
      description="An overlap of 0.1 lets each ridge rise barely into the row above."
      locale="en-US"
      rows={layers.slice(0, 6)}
      value={axis}
      overlap={0.1}
      densityLabel="density of activations"
    />
  ),
};

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <Ridgeline
        title="Loading"
        locale="en-US"
        status="loading"
        rows={[]}
        value={axis}
        densityLabel="density"
        height="compact"
      />
      <Ridgeline title="Empty" locale="en-US" rows={[]} value={axis} densityLabel="density" height="compact" />
      <Ridgeline
        title="Partial"
        locale="en-US"
        coverage={{ shown: 3, total: 96, unit: 'layers' }}
        rows={layers.slice(0, 3)}
        value={axis}
        densityLabel="density"
        height="compact"
      />
      <Ridgeline
        title="Invalid"
        locale="en-US"
        rows={layers.slice(0, 2)}
        value={axis}
        overlap={2}
        densityLabel="density"
        height="compact"
      />
    </ChartGrid>
  ),
};
