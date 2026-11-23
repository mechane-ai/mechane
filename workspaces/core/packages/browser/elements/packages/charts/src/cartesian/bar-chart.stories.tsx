import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel, Stack } from '../../../core/src/index.ts';
import { BarChart } from './bar-chart.tsx';
import type { BarAnnotation, BarMarker, BarSeries } from './bar-chart.tsx';
import type { ChartReferenceLine } from './reference-lines.tsx';

const meta = {
  title: 'Charts/Bar references and markers',
  component: BarChart,
  parameters: {
    docs: {
      description: {
        component:
          'BarChart can explain a comparison without another chart. Reference lines draw a supplied target or average across the plot with its label. Markers add a second value to each bar of one series: a tick for a single value, or a range whisker between two bounds. Annotations place a short note above chosen bars, and emphasized categories recede the others without changing selection. The application computes every value, chooses which bars to annotate, and writes the notes. Each overlay joins the inspector, the keyboard readout and the accessible exact values. Keep notes to a word or two and explain emphasis in the description.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const months = [
  { id: '2026-01', label: 'January 2026', axisLabel: 'Jan' },
  { id: '2026-02', label: 'February 2026', axisLabel: 'Feb' },
  { id: '2026-03', label: 'March 2026', axisLabel: 'Mar' },
  { id: '2026-04', label: 'April 2026', axisLabel: 'Apr' },
  { id: '2026-05', label: 'May 2026', axisLabel: 'May' },
  { id: '2026-06', label: 'June 2026', axisLabel: 'Jun' },
  { id: '2026-07', label: 'July 2026', axisLabel: 'Jul' },
  { id: '2026-08', label: 'August 2026', axisLabel: 'Aug' },
  { id: '2026-09', label: 'September 2026', axisLabel: 'Sep' },
  { id: '2026-10', label: 'October 2026', axisLabel: 'Oct' },
  { id: '2026-11', label: 'November 2026', axisLabel: 'Nov' },
  { id: '2026-12', label: 'December 2026', axisLabel: 'Dec' },
];

const plannedSpend: ReadonlyArray<BarSeries> = [
  {
    id: 'inference',
    label: 'Inference',
    tone: 'series1',
    values: [2.1, 2, 2.3, 2.4, 2.6, 2.5, 2.4, 2.6, 2.9, 3, 3.6, 4.1],
  },
  {
    id: 'training',
    label: 'Training',
    tone: 'series2',
    values: [1.2, 0.4, 0.4, 2.2, 0.5, 0.5, 0.6, 0.5, 2.4, 0.6, 0.7, 1.1],
  },
  {
    id: 'storage',
    label: 'Storage',
    tone: 'series4',
    values: [0.6, 0.6, 0.6, 0.7, 0.7, 0.7, 0.7, 0.8, 0.8, 0.8, 0.9, 0.9],
  },
];

const budget: ReadonlyArray<ChartReferenceLine> = [
  { id: 'budget', label: 'Monthly budget', value: 5.5, tone: 'negative' },
  { id: 'average', label: 'Average', value: 4.3 },
];

const peaks: ReadonlyArray<BarAnnotation> = [
  { id: 'april-peak', categoryId: '2026-04', label: 'Training run' },
  { id: 'september-peak', categoryId: '2026-09', label: 'Training run' },
  { id: 'december-peak', categoryId: '2026-12', label: 'Peak' },
];

const oneDecimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const upToOneDecimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

/** Values are in thousands of dollars, a unit no `Intl` option writes, so the story declares a function format. */
function thousands(value: number): string {
  return `$${oneDecimal.format(value)}k`;
}

function compactThousands(value: number): string {
  return `$${upToOneDecimal.format(value)}k`;
}

function PlannedSpend(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <BarChart
      title="Planned compute spend"
      locale="en-US"
      description="Synthetic plan in thousands of US dollars. Training runs in April and September raise those months; December carries seasonal inference demand."
      categories={months}
      series={plannedSpend}
      mode="stacked"
      domain={[0, 7]}
      valueFormat={thousands}
      tickFormat={compactThousands}
      valueLabel="Spend (USD)"
      referenceLines={budget}
      annotations={peaks}
      emphasizedCategoryIds={['2026-04', '2026-09', '2026-12']}
      selected={selected}
      onSelectedChange={setSelected}
      height="regular"
    />
  );
}

export const TargetsAndNotes: Story = { render: () => <PlannedSpend /> };

const regions = [
  { id: 'north', label: 'North region' },
  { id: 'east', label: 'East region' },
  { id: 'south', label: 'South region' },
  { id: 'west', label: 'West region' },
];

const typicalWait: ReadonlyArray<BarSeries> = [
  { id: 'typical', label: 'Typical day', tone: 'series1', values: [42, 55, 38, null] },
  { id: 'weekend', label: 'Weekend', tone: 'series3', values: [30, 41, 29, 35] },
];

const waitMarkers: ReadonlyArray<BarMarker> = [
  { id: 'slowest', label: 'Slowest day', seriesId: 'typical', kind: 'tick', values: [71, 96, 52, null] },
  {
    id: 'weekend-spread',
    label: 'Weekend middle half',
    seriesId: 'weekend',
    kind: 'range',
    lower: [24, 33, 22, 28],
    upper: [37, 52, 34, 44],
  },
];

const seconds = { style: 'unit', unit: 'second' } as const;

export const TicksAndRanges: Story = {
  render: () => (
    <Stack>
      <Panel>
        <BarChart
          title="Queue wait by region"
          locale="en-US"
          description="Synthetic waits in seconds. A tick marks each region's slowest day against its typical day; the whisker spans the middle half of weekend waits. The west region has no weekday record."
          categories={regions}
          series={typicalWait}
          domain={[0, 120]}
          valueFormat={seconds}
          markers={waitMarkers}
          referenceLines={[{ id: 'objective', label: 'Objective', value: 60, tone: 'positive' }]}
          annotations={[{ id: 'east-note', categoryId: 'east', seriesId: 'typical', label: 'Slowest' }]}
          height="regular"
        />
      </Panel>
    </Stack>
  ),
};

const quarterMonths = months.slice(0, 3);

export const States: Story = {
  render: () => (
    <Stack>
      <BarChart
        title="Loading spend"
        locale="en-US"
        status="loading"
        categories={quarterMonths}
        series={plannedSpend}
        valueFormat={thousands}
      />
      <BarChart
        title="No spend recorded"
        locale="en-US"
        categories={[]}
        series={[]}
        valueFormat={thousands}
        emptyLabel="No months have recorded spend yet."
      />
      <BarChart
        title="First quarter spend"
        description="Synthetic plan. The value axis is fitted from zero to the largest stack."
        locale="en-US"
        coverage={{ shown: 3, total: 12, unit: 'months' }}
        categories={quarterMonths}
        series={plannedSpend.map((item) => ({ ...item, values: item.values.slice(0, 3) }))}
        mode="stacked"
        valueFormat={thousands}
        tickFormat={compactThousands}
      />
      <BarChart
        title="Invalid stack"
        locale="en-US"
        categories={quarterMonths}
        series={[{ id: 'refund', label: 'Refund', values: [-1, 0.4, 0.2] }]}
        mode="stacked"
        valueFormat={thousands}
      />
    </Stack>
  ),
};
