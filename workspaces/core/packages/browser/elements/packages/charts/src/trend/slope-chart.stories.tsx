import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { SlopeChart } from './slope-chart.tsx';
import type { SlopeCondition, SlopeItem } from './slope-chart.tsx';

const meta = {
  title: 'Charts/SlopeChart',
  component: SlopeChart,
  parameters: {
    docs: {
      description: {
        component:
          'The same things measured under two or a few ordered conditions, such as benchmark scores before and after fine-tuning. Each item is one line across the conditions with its value written at the first and last column, and labels are moved apart so none overlap. A missing value breaks the line and is said in the readout. The application supplies every value. The data here is synthetic.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const scores = { label: 'Accuracy', domain: [0.2, 1], format: { style: 'percent', maximumFractionDigits: 1 } } as const;

const tuning: ReadonlyArray<SlopeCondition> = [
  { id: 'base', label: 'Base model' },
  { id: 'tuned', label: 'Fine-tuned' },
];

const benchmarks: ReadonlyArray<SlopeItem> = [
  { id: 'arithmetic', label: 'Arithmetic', values: [0.41, 0.78] },
  { id: 'code', label: 'Code completion', values: [0.52, 0.71] },
  { id: 'reading', label: 'Reading comprehension', values: [0.74, 0.79] },
  { id: 'facts', label: 'Factual recall', values: [0.69, 0.67] },
  { id: 'safety', label: 'Refusal accuracy', values: [0.58, 0.93] },
  { id: 'translation', label: 'Translation', values: [0.63, 0.64] },
  { id: 'summary', label: 'Summarization', values: [0.66, 0.7] },
  { id: 'logic', label: 'Logic puzzles', values: [0.35, 0.37] },
];

export const BeforeAndAfter: Story = {
  render: () => (
    <SlopeChart
      title="Benchmark accuracy before and after fine-tuning"
      description="Synthetic scores on eight benchmarks. Lines that climb gained from fine-tuning; the line that falls lost accuracy."
      locale="en-US"
      conditions={tuning}
      items={benchmarks}
      value={scores}
      source="Synthetic evaluation"
    />
  ),
};

const stages: ReadonlyArray<SlopeCondition> = [
  { id: 'base', label: 'Base' },
  { id: 'sft', label: 'Supervised' },
  { id: 'rl', label: 'Preference-tuned' },
];

const staged: ReadonlyArray<SlopeItem> = benchmarks.map((item, index) => ({
  ...item,
  values: [
    item.values[0] ?? null,
    index === 4 ? null : (item.values[0] ?? 0) + ((item.values[1] ?? 0) - (item.values[0] ?? 0)) * 0.6,
    item.values[1] ?? null,
  ],
}));

function SelectableSlope(): ReactNode {
  const [selected, setSelected] = useState<string | null>('arithmetic');

  return (
    <SlopeChart
      title="Three training stages"
      description="Press a line to select it. Refusal accuracy was not measured after supervised tuning, so its line breaks."
      locale="en-US"
      conditions={stages}
      items={staged}
      value={scores}
      selected={selected}
      onSelectedChange={(id) => setSelected(id)}
    />
  );
}

export const Selection: Story = { render: () => <SelectableSlope /> };

export const States: Story = {
  render: () => (
    <ChartGrid title="Every state has one look">
      <SlopeChart
        title="Loading"
        locale="en-US"
        status="loading"
        conditions={tuning}
        items={[]}
        value={scores}
        height="compact"
      />
      <SlopeChart title="Empty" locale="en-US" conditions={tuning} items={[]} value={scores} height="compact" />
      <SlopeChart
        title="Partial"
        locale="en-US"
        coverage={{ shown: 8, total: 120, unit: 'benchmarks' }}
        conditions={tuning}
        items={benchmarks}
        value={scores}
        height="compact"
      />
      <SlopeChart
        title="Invalid"
        locale="en-US"
        conditions={tuning.slice(0, 1)}
        items={benchmarks}
        value={scores}
        height="compact"
      />
    </ChartGrid>
  ),
};
