import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel, Stack } from '../../../core/src/index.ts';
import { BridgeChart } from './bridge-chart.tsx';
import type { BridgeStep } from './bridge-chart.tsx';

const meta = {
  title: 'Charts/Bridge',
  component: BridgeChart,
  parameters: {
    docs: {
      description: {
        component:
          'BridgeChart explains how a starting total becomes a result through signed changes. Columns float from the running total and dashed connectors carry it to the next step. Totals and subtotals start at zero. Increases default to the positive tone and decreases to the negative tone; supply tones when the steps already have colors elsewhere on the page. Labels carry the sign so color is never the only cue. A missing change leaves later levels unknown, drawn as dashed placeholders. Use BarChart for independent categories and BreakdownBar for parts of one total. The application supplies every change; the chart only stacks them.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

function formatDollars(value: number): string {
  return dollars.format(value);
}

const monthly: ReadonlyArray<BridgeStep> = [
  { id: 'income', label: 'Monthly income after tax', axisLabel: 'Income', kind: 'start', value: 6200, tone: 'series1' },
  { id: 'housing', label: 'Housing', kind: 'change', value: -1850, tone: 'series3' },
  {
    id: 'essentials',
    label: 'Essential spending',
    axisLabel: 'Essentials',
    kind: 'change',
    value: -1420,
    tone: 'series4',
  },
  { id: 'flexible', label: 'Flexible spending', axisLabel: 'Flexible', kind: 'change', value: -980, tone: 'series6' },
  { id: 'refund', label: 'Expected refund', axisLabel: 'Refund', kind: 'change', value: 150 },
  { id: 'remaining', label: 'Remaining to save', axisLabel: 'Remaining', kind: 'total', tone: 'series2' },
];

function MonthlyBridge(): ReactNode {
  const [selectedId, setSelectedId] = useState<string>();

  return (
    <BridgeChart
      title="Where a month's income goes"
      description="Synthetic plan in US dollars. The refund is a one-time increase this month."
      steps={monthly}
      formatValue={formatDollars}
      formatTick={(value) => `$${value / 1000}k`}
      referenceLines={[{ id: 'goal', label: 'Saving goal', value: 2500, tone: 'positive' }]}
      selection={{ selectedId, onSelect: setSelectedId }}
    />
  );
}

export const IncomeToRemainder: Story = { render: () => <MonthlyBridge /> };

const quarter: ReadonlyArray<BridgeStep> = [
  { id: 'opening', label: 'Opening backlog', axisLabel: 'Opening', kind: 'start', value: 420 },
  { id: 'new', label: 'New requests', axisLabel: 'New', kind: 'change', value: 310 },
  { id: 'closed', label: 'Closed requests', axisLabel: 'Closed', kind: 'change', value: -560 },
  { id: 'month', label: 'Backlog after one month', axisLabel: 'Month 1', kind: 'total' },
  { id: 'imported', label: 'Imported requests', axisLabel: 'Imported', kind: 'change', value: null },
  { id: 'resolved', label: 'Resolved by automation', axisLabel: 'Automated', kind: 'change', value: -90 },
  { id: 'closing', label: 'Closing backlog', axisLabel: 'Closing', kind: 'total' },
];

function formatRequests(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} requests`;
}

export const SubtotalsAndMissing: Story = {
  render: () => (
    <Stack>
      <Panel>
        <BridgeChart
          title="Request backlog"
          description="Synthetic counts. The imported count was not recorded, so the closing backlog is unknown."
          steps={quarter}
          formatValue={formatRequests}
          formatTick={String}
          height={220}
        />
      </Panel>
    </Stack>
  ),
};
