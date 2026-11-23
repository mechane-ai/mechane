import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { StripPlot } from './strip-plot.tsx';
import type { StripGroup, StripPoint } from './strip-plot.tsx';

const meta = {
  title: 'Charts/StripPlot',
  component: StripPlot,
  parameters: {
    docs: {
      description: {
        component:
          'Every observation as a dot in its group. Dots spread across the band by a fixed rule, so a reload never moves one, and they are translucent so piles read as density. An optional ink tick marks a median or mean the application computed. Use it when each observation can be shown. The stories use synthetic data.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const tasks: ReadonlyArray<StripGroup> = [
  { id: 'math', label: 'Math' },
  { id: 'code', label: 'Code' },
  { id: 'recall', label: 'Recall' },
];

const PER_TASK = 24;
const centers: Readonly<Record<string, number>> = { math: 0.45, code: 0.62, recall: 0.8 };

const seeds: ReadonlyArray<StripPoint> = tasks.flatMap((task) =>
  Array.from({ length: PER_TASK }, (_, index) => ({
    id: `${task.id}-${index}`,
    groupId: task.id,
    label: `Seed ${index + 1}`,
    value: (centers[task.id] ?? 0.5) + 0.12 * Math.sin(index * 2.3) * Math.cos(index * 0.7) + 0.02 * (index % 5),
  })),
);

const medians = { math: 0.46, code: 0.64, recall: 0.82 };
const accuracy = { label: 'Accuracy', domain: [0, 1], format: { style: 'percent' } } as const;

export const AccuracyBySeed: Story = {
  render: () => (
    <StripPlot
      title="Accuracy by task"
      description="Synthetic runs: one dot per seed, with the median of each task as an ink tick."
      locale="en-US"
      groups={tasks}
      points={seeds}
      value={accuracy}
      summary={medians}
      summaryLabel="Median"
      source="Synthetic sweep"
    />
  ),
};

function SelectableStrip(): ReactNode {
  const [selected, setSelected] = useState<string | null>('code-3');

  return (
    <StripPlot
      title="Pick a seed"
      description="Press a dot, or move with the arrow keys and press Enter, to select a seed."
      locale="en-US"
      groups={tasks}
      points={seeds}
      value={accuracy}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
      height="tall"
    />
  );
}

export const Selectable: Story = { render: () => <SelectableStrip /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <StripPlot
        title="Loading"
        locale="en-US"
        status="loading"
        groups={tasks}
        points={[]}
        value={accuracy}
        height="compact"
      />
      <StripPlot title="Empty" locale="en-US" groups={tasks} points={[]} value={accuracy} height="compact" />
      <StripPlot
        title="Partial"
        locale="en-US"
        coverage={{ shown: 72, total: 5000, unit: 'seeds' }}
        groups={tasks}
        points={seeds}
        value={accuracy}
        height="compact"
      />
      <StripPlot
        title="Invalid"
        locale="en-US"
        groups={tasks}
        points={[{ id: 'stray', groupId: 'audio', value: 0.5 }]}
        value={accuracy}
        height="compact"
      />
    </ChartGrid>
  ),
};
