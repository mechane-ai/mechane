import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { RunsChart } from './runs-chart.tsx';
import type { RunsSummary, TrainingRun } from './runs-chart.tsx';

const meta = {
  title: 'Charts/RunsChart',
  component: RunsChart,
  parameters: {
    docs: {
      description: {
        component:
          'Many training runs over a step axis. Every run is a thin gray line for context, and the runs the application names are drawn in their hue on top with their names at the end. An optional summary, such as the median and quartiles across runs, is drawn as a line with a band. Pointing at a run, or stepping to it with the arrow keys, shows its last recorded step and value. The application chooses the featured runs and computes the summary. The data here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const STEP_COUNT = 51;
const STEP_SIZE = 200;
const steps = Array.from({ length: STEP_COUNT }, (_, index) => index * STEP_SIZE);

const runs: ReadonlyArray<TrainingRun> = Array.from({ length: 48 }, (_, index) => {
  const floor = 1.3 + 1.1 * Math.abs(Math.sin(index * 1.7));
  const rate = 0.0006 + 0.0004 * Math.abs(Math.cos(index * 2.3));

  return {
    id: `run-${index + 1}`,
    label: `Run ${index + 1}`,
    points: steps.map((step) => ({
      x: step,
      y:
        index === 17 && step >= 6000
          ? null
          : floor + (4.4 - floor) * Math.exp(-rate * step) + 0.05 * Math.sin(step / 330 + index),
    })),
  };
});

function quantile(values: ReadonlyArray<number>, share: number): number {
  const sorted = values.toSorted((first, second) => first - second);

  return sorted[Math.floor(share * (sorted.length - 1))] ?? 0;
}

const median: RunsSummary = {
  label: 'Median',
  points: steps.map((step, index) => {
    const losses = runs.flatMap((run) => run.points[index]?.y ?? []);

    return { x: step, center: quantile(losses, 0.5), lower: quantile(losses, 0.25), upper: quantile(losses, 0.75) };
  }),
};

const stepAxis = { label: 'Training step', domain: [0, 10_000], format: { maximumFractionDigits: 0 } } as const;
const lossAxis = { label: 'Validation loss (nats)', domain: [1, 5], format: { maximumFractionDigits: 2 } } as const;

export const SweepOfRuns: Story = {
  render: () => (
    <RunsChart
      title="Validation loss across a learning-rate sweep"
      description="Synthetic sweep of 48 runs. Gray lines are every run; the band spans the quartiles across runs."
      locale="en-US"
      runs={runs}
      x={stepAxis}
      y={lossAxis}
      featured={['run-4', 'run-11', 'run-30']}
      summary={median}
      source="Synthetic sweep"
      transforms={['Quartiles across 48 runs']}
    />
  ),
};

function SelectableRuns(): ReactNode {
  const [selected, setSelected] = useState<string | null>('run-18');

  return (
    <RunsChart
      title="Pick a run"
      description="Press a run to select it. Run 18 stopped recording at step 6,000, so its line ends there."
      locale="en-US"
      runs={runs}
      x={stepAxis}
      y={lossAxis}
      featured={[]}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
      height="tall"
    />
  );
}

export const Selection: Story = { render: () => <SelectableRuns /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <RunsChart
        title="Loading"
        locale="en-US"
        status="loading"
        runs={[]}
        x={stepAxis}
        y={lossAxis}
        featured={[]}
        height="compact"
      />
      <RunsChart title="Empty" locale="en-US" runs={[]} x={stepAxis} y={lossAxis} featured={[]} height="compact" />
      <RunsChart
        title="Partial"
        locale="en-US"
        coverage={{ shown: 48, total: 960, unit: 'runs' }}
        runs={runs}
        x={stepAxis}
        y={lossAxis}
        featured={['run-4']}
        height="compact"
      />
      <RunsChart
        title="Invalid"
        locale="en-US"
        runs={runs}
        x={stepAxis}
        y={lossAxis}
        featured={['run-999']}
        height="compact"
      />
    </ChartGrid>
  ),
};
