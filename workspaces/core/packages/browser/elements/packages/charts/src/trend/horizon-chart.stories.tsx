import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChartGrid } from '../chart-grid.tsx';
import { HorizonChart } from './horizon-chart.tsx';
import type { HorizonSeries } from './horizon-chart.tsx';

const meta = {
  title: 'Charts/HorizonChart',
  component: HorizonChart,
  parameters: {
    docs: {
      description: {
        component:
          'Many series in little vertical space, such as per-layer activation statistics. Each series is a short row that folds its values into layers: every layer is a darker step of one hue above zero and of a second hue below zero. The rows share one x axis and one value domain, so colors compare across rows, and the legend states where each band starts. The application supplies the values and the domain. The data here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const POSITIONS = 96;
const positions = Array.from({ length: POSITIONS }, (_, index) => index);

const layers: ReadonlyArray<HorizonSeries> = Array.from({ length: 16 }, (_, layer) => ({
  id: `layer-${layer}`,
  label: `Layer ${layer}`,
  points: positions.map((position) => ({
    x: position,
    y: Math.max(
      -1,
      Math.min(
        1,
        (0.25 + layer * 0.045) * Math.sin(position / (4 + layer / 2) + layer) + 0.2 * Math.cos(position / 17),
      ),
    ),
  })),
}));

const tokens = { label: 'Token position', domain: [0, 95], format: { maximumFractionDigits: 0 } } as const;
const activation = { label: 'Mean activation', domain: [-1, 1], format: { maximumFractionDigits: 2 } } as const;

export const ActivationsByLayer: Story = {
  render: () => (
    <HorizonChart
      title="Mean activation by layer"
      description="Synthetic activations of 16 layers over 96 token positions. Blue is above zero, red below; a darker band is a larger magnitude."
      locale="en-US"
      series={layers}
      x={tokens}
      value={activation}
      bands={4}
      source="Synthetic probe"
    />
  ),
};

export const ThreeBands: Story = {
  render: () => (
    <HorizonChart
      title="Late layers, three bands"
      description="Layer 12 has no recording from position 40 to 55, so its row has a gap."
      locale="en-US"
      series={layers
        .slice(8, 14)
        .map((item) => ({
          ...item,
          points: item.points.map((point) => ({
            x: point.x,
            y: item.id === 'layer-12' && point.x >= 40 && point.x <= 55 ? null : point.y,
          })),
        }))}
      x={tokens}
      value={activation}
      bands={3}
      height="tall"
    />
  ),
};

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <HorizonChart
        title="Loading"
        locale="en-US"
        status="loading"
        series={[]}
        x={tokens}
        value={activation}
        bands={2}
      />
      <HorizonChart title="Empty" locale="en-US" series={[]} x={tokens} value={activation} bands={2} />
      <HorizonChart
        title="Partial"
        locale="en-US"
        coverage={{ shown: 4, total: 96, unit: 'layers' }}
        series={layers.slice(0, 4)}
        x={tokens}
        value={activation}
        bands={2}
        height="compact"
      />
      <HorizonChart
        title="Invalid"
        locale="en-US"
        series={layers.slice(0, 2)}
        x={tokens}
        value={{ ...activation, domain: [0.5, 1] }}
        bands={2}
        height="compact"
      />
    </ChartGrid>
  ),
};
