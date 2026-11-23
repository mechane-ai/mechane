import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChartGrid } from '../chart-grid.tsx';
import { BulletBar } from './bullet-bar.tsx';
import type { BulletRow } from './bullet-bar.tsx';

const meta = {
  title: 'Charts/BulletBar',
  component: BulletBar,
  parameters: {
    docs: {
      description: {
        component:
          'A measured bar against a target and qualitative ranges, one per row. Use it to read several measures against their objectives: latency against a service-level objective, or an eval pass rate against the release bar. The bar starts at zero, the ranges are steps of gray behind it and the target is a tick. The application supplies every value, target and range.',
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj;

const bands = [
  { upTo: 120, label: 'Within objective' },
  { upTo: 200, label: 'Degraded' },
  { upTo: 320, label: 'Breaching' },
] as const;

const latency: ReadonlyArray<BulletRow> = [
  { id: 'search', label: 'Search', value: 96, target: 120, ranges: bands },
  { id: 'checkout', label: 'Checkout', value: 164, target: 120, ranges: bands },
  { id: 'upload', label: 'Upload', value: 238, target: 120, ranges: bands },
  { id: 'login', label: 'Login', value: 71, target: 120, ranges: bands },
  { id: 'export', label: 'Export', value: null, target: 120, ranges: bands },
];

const milliseconds = { label: 'p95 latency (ms)', domain: [0, 320], format: { maximumFractionDigits: 0 } } as const;

export const Default: Story = {
  render: () => (
    <BulletBar
      title="Latency against the objective"
      description="Synthetic service data. The tick marks the 120 ms objective; the shaded steps are its degraded and breaching ranges. Export reported no measurement."
      locale="en-US"
      rows={latency}
      value={milliseconds}
      source="Synthetic traces"
    />
  ),
};

const bar = [
  { upTo: 0.7, label: 'Blocks release' },
  { upTo: 0.85, label: 'Needs review' },
  { upTo: 1, label: 'Ready' },
] as const;

const evals: ReadonlyArray<BulletRow> = [
  { id: 'reasoning', label: 'Reasoning', value: 0.88, target: 0.85, ranges: bar },
  { id: 'coding', label: 'Coding', value: 0.79, target: 0.85, ranges: bar },
  {
    id: 'safety',
    label: 'Safety',
    value: 0.97,
    target: 0.95,
    ranges: [
      { upTo: 0.9, label: 'Blocks release' },
      { upTo: 1, label: 'Ready' },
    ],
  },
];

function Selectable(): ReactNode {
  const [selected, setSelected] = useState<string | null>('coding');

  return (
    <BulletBar
      title="Eval pass rate against the release bar"
      description="Synthetic evals. Press a row, or move with the arrow keys and press Enter, to select it."
      locale="en-US"
      rows={evals}
      value={{ label: 'Pass rate', format: { style: 'percent', maximumFractionDigits: 0 } }}
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
      <BulletBar title="Loading" locale="en-US" status="loading" rows={[]} value={milliseconds} height="compact" />
      <BulletBar title="Empty" locale="en-US" rows={[]} value={milliseconds} height="compact" />
      <BulletBar
        title="Partial"
        locale="en-US"
        coverage={{ shown: 3, total: 24, unit: 'services' }}
        rows={latency.slice(0, 3)}
        value={milliseconds}
        height="compact"
      />
      <BulletBar
        title="Invalid"
        locale="en-US"
        rows={latency.slice(0, 3)}
        value={{ ...milliseconds, domain: [50, 320] }}
        height="compact"
      />
    </ChartGrid>
  ),
};
