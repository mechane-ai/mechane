import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Stack, Text } from '../../../core/src/index.ts';
import { BreakdownBar } from '../cartesian/breakdown-bar.tsx';
import type { BreakdownItem } from '../categorical-values.tsx';
import { Treemap } from './treemap.tsx';

const meta = {
  title: 'Charts/Hierarchy',
  component: Treemap,
  parameters: {
    docs: {
      description: {
        component:
          'Treemap sizes supplied nonnegative categories by their recorded value. Missing values have no area. Use BreakdownBar when the declared total and an unassigned portion matter. Shared selection links representations without inferring a hierarchy or causal relationship.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

function formatTokens(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} tokens`;
}

const allocation: ReadonlyArray<BreakdownItem> = [
  { id: 'input', label: 'Input', value: 840, tone: 'series1' },
  { id: 'output', label: 'Output', value: 260, tone: 'series2' },
  { id: 'cache-read', label: 'Cache read', value: 500, tone: 'series3' },
  { id: 'cache-write', label: 'Cache write', value: 0, tone: 'series4' },
];

function UsageAllocation(): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <Stack>
      <BreakdownBar
        title="Token usage"
        locale="en-US"
        description="Synthetic completed request. Input excludes cached tokens."
        items={allocation}
        total={1600}
        valueFormat={formatTokens}
        selected={selected}
        onSelectedChange={setSelected}
      />
      <Treemap
        title="Token allocation"
        locale="en-US"
        items={allocation}
        valueFormat={formatTokens}
        selected={selected}
        onSelectedChange={setSelected}
      />
      <Text>{selected === null ? 'Select a category to link the two views.' : `Selected category: ${selected}`}</Text>
    </Stack>
  );
}

export const Allocation: Story = { render: () => <UsageAllocation /> };

export const NarrowLongLabels: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  render: () => (
    <Treemap
      title="Supplied allocation with complete category labels"
      locale="en-US"
      description="Synthetic values. Missing and zero categories keep their text without receiving an area."
      items={[
        { id: 'input', label: 'Input for the complete validation and review sequence', value: 840 },
        { id: 'output', label: 'Output from the accepted reference collection', value: 260 },
        { id: 'zero', label: 'Measured zero for the unused category', value: 0 },
        { id: 'missing', label: 'Category without recorded evidence', value: null },
      ]}
      valueFormat={formatTokens}
    />
  ),
};

export const States: Story = {
  render: () => (
    <Stack>
      <Treemap title="Loading allocation" locale="en-US" status="loading" items={[]} valueFormat={formatTokens} />
      <Treemap title="No allocation records" locale="en-US" items={[]} valueFormat={formatTokens} />
      <Treemap
        title="Allocation for sampled requests"
        locale="en-US"
        coverage={{ shown: 120, total: 2400, unit: 'requests' }}
        items={allocation}
        valueFormat={formatTokens}
      />
      <Treemap
        title="Negative allocation"
        locale="en-US"
        items={[{ id: 'refund', label: 'Refunded tokens', value: -40 }]}
        valueFormat={formatTokens}
      />
    </Stack>
  ),
};
