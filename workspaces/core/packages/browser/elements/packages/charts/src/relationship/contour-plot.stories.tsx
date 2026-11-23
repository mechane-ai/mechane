import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { ContourPlot } from './contour-plot.tsx';
import type { ContourGridInput } from './contour-plot.tsx';

const meta = {
  title: 'Charts/ContourPlot',
  component: ContourPlot,
  parameters: {
    docs: {
      description: {
        component:
          'Level lines of a surface sampled on a grid, such as a loss landscape. Each level is one line whose shade steps with its value, a few are labelled in place, and a path such as an optimizer trajectory can be drawn over them. The application supplies the sampled grid (up to 128 by 128), the levels (up to 16) and any path or markers. The stories use a synthetic landscape.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const SIZE = 64;
const X_DOMAIN = [-2, 2] as const;
const Y_DOMAIN = [-1, 3] as const;

function surface(x: number, y: number): number {
  return Math.log1p((1 - x) ** 2 + 5 * (y - x * x) ** 2);
}

const grid: ContourGridInput = {
  columns: SIZE,
  rows: SIZE,
  xDomain: X_DOMAIN,
  yDomain: Y_DOMAIN,
  values: Array.from({ length: SIZE * SIZE }, (_, index) => {
    const column = index % SIZE;
    const row = Math.floor(index / SIZE);

    return surface(
      X_DOMAIN[0] + (column / (SIZE - 1)) * (X_DOMAIN[1] - X_DOMAIN[0]),
      Y_DOMAIN[0] + (row / (SIZE - 1)) * (Y_DOMAIN[1] - Y_DOMAIN[0]),
    );
  }),
};

const levels = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5];
const steps = Array.from({ length: 17 }, (_, index) => index / 16);

const trajectory = [
  {
    id: 'adam',
    label: 'Adam run',
    points: steps.map((step) => {
      const eased = 1 - (1 - step) ** 2;

      return { x: -1.5 + 2.5 * eased, y: 2.5 - 1.5 * eased + 1.4 * Math.sin(Math.PI * eased) * (1 - eased) };
    }),
  },
];

const markers = [
  { id: 'start', label: 'Start', x: -1.5, y: 2.5 },
  { id: 'minimum', label: 'Minimum', x: 1, y: 1 },
];

const axes = {
  x: { label: 'Weight A', format: { maximumFractionDigits: 1 } },
  y: { label: 'Weight B', format: { maximumFractionDigits: 1 } },
  value: { label: 'Loss (nats)', format: { maximumFractionDigits: 1 } },
} as const;

export const LossLandscape: Story = {
  render: () => (
    <ContourPlot
      title="Loss landscape"
      description="Synthetic surface sampled on a 64 by 64 grid. Darker lines are higher loss; the path is one optimizer run."
      locale="en-US"
      grid={grid}
      levels={levels}
      {...axes}
      path={trajectory}
      markers={markers}
      source="Synthetic surface"
    />
  ),
};

function Interactive(): ReactNode {
  const [selected, setSelected] = useState<string | null>('minimum');

  return (
    <ContourPlot
      title="Pick a level or a marker"
      description="Press a line or a marker, or move with the arrow keys and press Enter, to select it."
      locale="en-US"
      grid={grid}
      levels={levels}
      {...axes}
      markers={markers}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
      height="regular"
    />
  );
}

export const Selectable: Story = { render: () => <Interactive /> };

export const States: Story = {
  render: () => {
    const empty = { ...grid, columns: 0, rows: 0, values: [] };

    return (
      <ChartGrid title="Every state has one look" minPanelWidth={420}>
        <ContourPlot
          title="Loading"
          locale="en-US"
          status="loading"
          grid={empty}
          levels={levels}
          {...axes}
          height="compact"
        />
        <ContourPlot title="Empty" locale="en-US" grid={empty} levels={levels} {...axes} height="compact" />
        <ContourPlot
          title="Partial"
          locale="en-US"
          grid={grid}
          levels={levels}
          {...axes}
          coverage={{ shown: 4096, total: 1_048_576, unit: 'samples' }}
          height="compact"
        />
        <ContourPlot title="Invalid" locale="en-US" grid={grid} levels={[2, 1]} {...axes} height="compact" />
      </ChartGrid>
    );
  },
};
