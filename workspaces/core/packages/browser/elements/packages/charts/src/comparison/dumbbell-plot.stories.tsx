import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { DumbbellPlot } from './dumbbell-plot.tsx';
import type { DumbbellRow } from './dumbbell-plot.tsx';

const meta = {
  title: 'Charts/DumbbellPlot',
  component: DumbbellPlot,
  parameters: {
    docs: {
      description: {
        component:
          'Two values per row joined by a segment: before and after, or one condition against another. Use it to show how far each category moved. The segment is gray context and the two ends are dots in two hues. A row with one end missing draws the present dot only. The application supplies every value.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const names = [
  'Arithmetic',
  'Code',
  'Logic',
  'Open QA',
  'Summaries',
  'Translation',
  'Safety refusals',
  'Chart reading',
];

const tasks: ReadonlyArray<DumbbellRow> = names.map((label, index) => {
  const before = 0.45 + 0.05 * ((index * 3) % 7);

  return {
    id: label.toLowerCase().replaceAll(' ', '-'),
    label,
    from: before,
    to: index === names.length - 1 ? null : Math.min(0.98, before + 0.16 * Math.sin(index + 1) + 0.08),
  };
});

const score = { label: 'Pass rate', domain: [0.3, 1], format: { style: 'percent', maximumFractionDigits: 1 } } as const;

export const Default: Story = {
  render: () => (
    <DumbbellPlot
      title="Score before and after fine-tuning"
      description="Synthetic evaluation. Chart reading was not re-run after fine-tuning, so only its first score is drawn."
      locale="en-US"
      rows={tasks}
      fromLabel="Before"
      toLabel="After"
      value={score}
      source="Synthetic evaluation"
    />
  ),
};

function Selectable(): ReactNode {
  const [selected, setSelected] = useState<string | null>('logic');

  return (
    <DumbbellPlot
      title="Score before and after fine-tuning"
      description="Press a row, or move with the arrow keys and press Enter, to select it."
      locale="en-US"
      rows={tasks.slice(0, 5)}
      fromLabel="Before"
      toLabel="After"
      fromTone="series3"
      toTone="series4"
      value={score}
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
      <DumbbellPlot
        title="Loading"
        locale="en-US"
        status="loading"
        rows={[]}
        fromLabel="Before"
        toLabel="After"
        value={score}
        height="compact"
      />
      <DumbbellPlot
        title="Empty"
        locale="en-US"
        rows={[]}
        fromLabel="Before"
        toLabel="After"
        value={score}
        height="compact"
      />
      <DumbbellPlot
        title="Partial"
        locale="en-US"
        coverage={{ shown: 3, total: 40, unit: 'tasks' }}
        rows={tasks.slice(0, 3)}
        fromLabel="Before"
        toLabel="After"
        value={score}
        height="compact"
      />
      <DumbbellPlot
        title="Invalid"
        locale="en-US"
        rows={tasks.slice(0, 3)}
        fromLabel="Before"
        toLabel="After"
        value={{ ...score, domain: [0.9, 1] }}
        height="compact"
      />
    </ChartGrid>
  ),
};
