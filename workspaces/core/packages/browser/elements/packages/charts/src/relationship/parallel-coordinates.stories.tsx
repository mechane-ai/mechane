import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import type { MeasureDimension, MeasureRow } from './measures.ts';
import { ParallelCoordinates } from './parallel-coordinates.tsx';
import type { AxisRanges } from './parallel-coordinates.tsx';

const meta = {
  title: 'Charts/ParallelCoordinates',
  component: ParallelCoordinates,
  parameters: {
    docs: {
      description: {
        component:
          'Many measures per item on parallel vertical axes, one line per row, for reading a hyperparameter sweep. Drag along an axis, or type bounds in the details row under the plot, to keep a range; rows outside every range turn gray. The application supplies two to twelve dimensions, up to 500 rows, and holds the ranges and selection. The stories use a synthetic sweep.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const optimizers = [
  { id: 'adam', label: 'Adam' },
  { id: 'sgd', label: 'SGD' },
  { id: 'lion', label: 'Lion' },
] as const;

const RUNS = 48;

function unit(index: number, salt: number): number {
  return Math.abs(Math.sin(index * 12.9898 + salt * 78.233) * 43_758.5453) % 1;
}

function sweep(): ReadonlyArray<MeasureRow> {
  return Array.from({ length: RUNS }, (_, index) => {
    const rate = 10 ** (-4.5 + 2.5 * unit(index, 1));
    const batch = 2 ** Math.round(4 + 5 * unit(index, 2));
    const dropout = 0.3 * unit(index, 3);
    const decay = 10 ** (-5 + 3 * unit(index, 4));
    const loss = 1.4 + 0.5 * (Math.log10(rate) + 3.2) ** 2 + 2 * (dropout - 0.1) ** 2 + 0.1 * unit(index, 5);

    return {
      id: `run-${index + 1}`,
      label: `Run ${index + 1}`,
      group: optimizers[index % optimizers.length]?.id,
      values: { rate, batch, dropout, decay, loss: index === 7 ? null : loss },
    };
  });
}

const dimensions: ReadonlyArray<MeasureDimension> = [
  {
    id: 'rate',
    label: 'Learning rate',
    scale: 'log',
    domain: [0.00001, 0.01],
    format: { maximumSignificantDigits: 2 },
  },
  { id: 'batch', label: 'Batch size', scale: 'log', domain: [16, 512], format: { maximumFractionDigits: 0 } },
  { id: 'dropout', label: 'Dropout', domain: [0, 0.3], format: { maximumFractionDigits: 2 } },
  {
    id: 'decay',
    label: 'Weight decay',
    scale: 'log',
    domain: [0.00001, 0.01],
    format: { maximumSignificantDigits: 2 },
  },
  { id: 'loss', label: 'Validation loss (nats)', domain: [1, 4], format: { maximumFractionDigits: 2 } },
];

export const Sweep: Story = {
  render: () => (
    <ParallelCoordinates
      title="Hyperparameter sweep"
      description="Synthetic sweep of 48 runs. Run 8 has no validation loss, so its line stops at the fourth axis."
      locale="en-US"
      dimensions={dimensions}
      rows={sweep()}
      groups={optimizers}
      source="Synthetic sweep"
    />
  ),
};

function Interactive(): ReactNode {
  const [ranges, setRanges] = useState<AxisRanges>({ loss: [1, 1.8] });
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <ParallelCoordinates
      title="Keep the best runs"
      description="Drag along an axis to keep a range, or open Axis ranges to type bounds. Gray lines fall outside a range."
      locale="en-US"
      dimensions={dimensions}
      rows={sweep()}
      groups={optimizers}
      ranges={ranges}
      onRangesChange={(next) => setRanges(next)}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Brushed: Story = { render: () => <Interactive /> };

const wide: ReadonlyArray<MeasureDimension> = Array.from({ length: 12 }, (_, index) => ({
  id: `m${index}`,
  label: `Measure ${index + 1}`,
  domain: [0, 1],
  format: { maximumFractionDigits: 2 },
}));

export const TwelveAxes: Story = {
  render: () => (
    <ParallelCoordinates
      title="Twelve measures"
      description="The most axes one chart draws. Titles tilt when the axes are close."
      locale="en-US"
      dimensions={wide}
      rows={Array.from({ length: 30 }, (_, row) => ({
        id: `row-${row}`,
        label: `Row ${row + 1}`,
        values: Object.fromEntries(wide.map((dimension, index) => [dimension.id, unit(row, index + 10)])),
      }))}
    />
  ),
};

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look" minPanelWidth={420}>
      <ParallelCoordinates
        title="Loading"
        locale="en-US"
        status="loading"
        dimensions={dimensions}
        rows={[]}
        height="compact"
      />
      <ParallelCoordinates title="Empty" locale="en-US" dimensions={dimensions} rows={[]} height="compact" />
      <ParallelCoordinates
        title="Partial"
        locale="en-US"
        dimensions={dimensions}
        rows={sweep()}
        groups={optimizers}
        coverage={{ shown: 48, total: 2000, unit: 'runs' }}
        height="compact"
      />
      <ParallelCoordinates
        title="Invalid"
        locale="en-US"
        dimensions={dimensions}
        rows={sweep()}
        groups={optimizers}
        ranges={{ loss: [3, 2] }}
        height="compact"
      />
    </ChartGrid>
  ),
};
