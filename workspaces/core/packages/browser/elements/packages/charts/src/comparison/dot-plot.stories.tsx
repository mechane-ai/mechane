import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { DotPlot } from './dot-plot.tsx';
import type { DotPlotSeries } from './dot-plot.tsx';

const meta = {
  title: 'Charts/DotPlot',
  component: DotPlot,
  parameters: {
    docs: {
      description: {
        component:
          'A Cleveland dot plot: one dot per series on each named row, along one shared measured axis. Use it to compare categories, such as model accuracy per task, when position reads better than bar length and the axis need not start at zero. Intervals are drawn behind their dots. The application supplies every value and interval.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const tasks = [
  { id: 'arith', label: 'Arithmetic' },
  { id: 'code', label: 'Code completion' },
  { id: 'logic', label: 'Logic puzzles' },
  { id: 'qa', label: 'Open-domain QA' },
  { id: 'summary', label: 'Summarization' },
  { id: 'translate', label: 'Translation' },
  { id: 'vision', label: 'Chart reading' },
];

const MARGIN = 0.03;

function model({
  id,
  label,
  skill,
  hasInterval = true,
  gaps = [],
}: {
  readonly id: string;
  readonly label: string;
  readonly skill: number;
  readonly hasInterval?: boolean;
  readonly gaps?: ReadonlyArray<string>;
}): DotPlotSeries {
  const scores = tasks.map((task, index) => ({
    id: task.id,
    score: Math.min(0.97, skill - (0.04 * ((index * 5) % 7)) / 2 + 0.12 * Math.sin(index + skill * 9)),
  }));

  return {
    id,
    label,
    values: Object.fromEntries(scores.map((entry) => [entry.id, gaps.includes(entry.id) ? null : entry.score])),
    intervals: hasInterval
      ? Object.fromEntries(
          scores
            .filter((entry) => !gaps.includes(entry.id))
            .map((entry) => [entry.id, { lower: entry.score - MARGIN, upper: entry.score + MARGIN }]),
        )
      : undefined,
  };
}

const models: ReadonlyArray<DotPlotSeries> = [
  model({ id: 'small', label: 'Small', skill: 0.62 }),
  model({ id: 'base', label: 'Base', skill: 0.74 }),
  model({ id: 'large', label: 'Large', skill: 0.84, gaps: ['vision'] }),
];

const accuracy = {
  label: 'Accuracy',
  domain: [0.3, 1],
  format: { style: 'percent', maximumFractionDigits: 1 },
} as const;

export const Default: Story = {
  render: () => (
    <DotPlot
      title="Accuracy by task"
      description="Synthetic benchmark. Bars behind each dot span a 95% confidence interval; the large model was not run on chart reading."
      locale="en-US"
      rows={tasks}
      series={models}
      value={accuracy}
      source="Synthetic evaluation"
    />
  ),
};

function Selectable(): ReactNode {
  const [selected, setSelected] = useState<string | null>('code');

  return (
    <DotPlot
      title="Accuracy by task"
      description="Press a row, or move with the arrow keys and press Enter, to select it."
      locale="en-US"
      rows={tasks}
      series={models.slice(0, 2)}
      value={accuracy}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
      height="compact"
    />
  );
}

export const Interactive: Story = { render: () => <Selectable /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <DotPlot
        title="Loading"
        locale="en-US"
        status="loading"
        rows={[]}
        series={[]}
        value={accuracy}
        height="compact"
      />
      <DotPlot title="Empty" locale="en-US" rows={[]} series={[]} value={accuracy} height="compact" />
      <DotPlot
        title="Partial"
        locale="en-US"
        coverage={{ shown: 3, total: 40, unit: 'tasks' }}
        rows={tasks.slice(0, 3)}
        series={models.slice(0, 1)}
        value={accuracy}
        height="compact"
      />
      <DotPlot
        title="Invalid"
        locale="en-US"
        rows={tasks.slice(0, 3)}
        series={models.slice(0, 1)}
        value={{ ...accuracy, domain: [0.9, 1] }}
        height="compact"
      />
    </ChartGrid>
  ),
};
