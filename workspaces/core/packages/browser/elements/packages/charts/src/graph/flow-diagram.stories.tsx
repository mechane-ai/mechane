import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Panel, Stack } from '../../../core/src/index.ts';
import { FlowDiagram } from './flow-diagram.tsx';
import type { FlowLink, FlowNode } from './flow-diagram.tsx';

const meta = {
  title: 'Charts/Flow',
  component: FlowDiagram,
  parameters: {
    docs: {
      description: {
        component:
          'FlowDiagram shows how supplied amounts divide and move between stages. Node height and ribbon width share one scale, so equal amounts have equal size anywhere in the diagram. Columns follow the links: sources first, then each later stage. Nodes keep their supplied order within a column. Ribbons take the color of the node they reach unless a link supplies a tone. Pointing, tapping or using the arrow keys highlights a node with its flows, or one flow with its ends, and the readout states the exact amount. A null amount draws a dashed thread and adds nothing. A node whose outflow is smaller than its inflow keeps the difference visible as uncovered height. Links may not form a cycle. The render limit is 64 nodes and 256 links. Use BreakdownBar for one level of parts and RelationGraph for unweighted relationships.',
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

const budgetNodes: ReadonlyArray<FlowNode> = [
  { id: 'income', label: 'Income after tax', tone: 'series1' },
  { id: 'housing', label: 'Housing', tone: 'series3' },
  { id: 'spending', label: 'Spending', tone: 'series4' },
  { id: 'saving', label: 'Saving', tone: 'series2' },
  { id: 'groceries', label: 'Groceries', tone: 'series4' },
  { id: 'transport', label: 'Transport', tone: 'series4' },
  { id: 'dining', label: 'Dining out', tone: 'series6' },
  { id: 'other', label: 'Everything else', tone: 'neutral' },
];

const budgetLinks: ReadonlyArray<FlowLink> = [
  { id: 'income-housing', sourceId: 'income', targetId: 'housing', value: 1850 },
  { id: 'income-spending', sourceId: 'income', targetId: 'spending', value: 2400 },
  { id: 'income-saving', sourceId: 'income', targetId: 'saving', value: 1950 },
  { id: 'spending-groceries', sourceId: 'spending', targetId: 'groceries', value: 820 },
  { id: 'spending-transport', sourceId: 'spending', targetId: 'transport', value: 460 },
  { id: 'spending-dining', sourceId: 'spending', targetId: 'dining', value: 390 },
  { id: 'spending-other', sourceId: 'spending', targetId: 'other', value: 730 },
];

function MonthlyFlow(): ReactNode {
  const [selectedId, setSelectedId] = useState<string>();

  return (
    <FlowDiagram
      title="Where a month's income goes"
      description="Synthetic monthly plan in US dollars. Spending divides into its largest categories."
      nodes={budgetNodes}
      links={budgetLinks}
      formatValue={formatDollars}
      selection={{ selectedId, onSelect: setSelectedId }}
    />
  );
}

export const DividedTotal: Story = { render: () => <MonthlyFlow /> };

const requestNodes: ReadonlyArray<FlowNode> = [
  { id: 'web', label: 'Web' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'gateway', label: 'Gateway', tone: 'series5' },
  { id: 'cache', label: 'Cache hits', tone: 'positive' },
  { id: 'service', label: 'Service', tone: 'series3' },
  { id: 'rejected', label: 'Rejected', tone: 'negative' },
];

const requestLinks: ReadonlyArray<FlowLink> = [
  { id: 'web-gateway', sourceId: 'web', targetId: 'gateway', value: 6400 },
  { id: 'mobile-gateway', sourceId: 'mobile', targetId: 'gateway', value: 3100 },
  { id: 'gateway-cache', sourceId: 'gateway', targetId: 'cache', value: 4200 },
  { id: 'gateway-service', sourceId: 'gateway', targetId: 'service', value: 4700 },
  { id: 'gateway-rejected', sourceId: 'gateway', targetId: 'rejected', value: 0 },
  { id: 'mobile-service', sourceId: 'mobile', targetId: 'service', value: null },
];

function formatRequests(value: number): string {
  return `${new Intl.NumberFormat('en-US').format(value)} requests`;
}

export const MergedSourcesAndGaps: Story = {
  render: () => (
    <Stack>
      <Panel>
        <FlowDiagram
          title="Request routing"
          description="Synthetic hour of traffic. No requests were rejected, and direct mobile traffic was not measured. The gateway forwards 600 fewer requests than it receives; the uncovered height shows that difference."
          nodes={requestNodes}
          links={requestLinks}
          formatValue={formatRequests}
          height={220}
        />
      </Panel>
    </Stack>
  ),
};
