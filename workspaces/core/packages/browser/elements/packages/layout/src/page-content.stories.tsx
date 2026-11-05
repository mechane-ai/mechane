import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download } from 'lucide-react';
import { CollectionToolbar, DataTable, Metric, MetricGrid } from '../../collections/src/index.ts';
import { Stack, Subheading, Text } from '../../core/src/index.ts';
import { PageContent } from './page-content.tsx';
import { PageToolbar, ToolbarAction } from './page-toolbar.tsx';

const meta = {
  title: 'Layout/PageContent',
  component: PageContent,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'PageContent gives reports a 16px content inset and 32px between sections. It leaves width and scrolling with the containing page. Keep full-width tables outside PageContent: their cells own the same 16px inset. PageToolbar and CollectionToolbar each own their bottom separator and omit an empty bar. Use DetailPage for a centered reading column.',
      },
    },
  },
} satisfies Meta<typeof PageContent>;

export default meta;
type Story = StoryObj;

export const ReportWithRecords: Story = {
  render: () => (
    <>
      <PageToolbar
        showNavigation={false}
        title="Review activity"
        actions={<ToolbarAction icon={<Download size={16} aria-hidden />}>Export</ToolbarAction>}
      />
      <PageContent>
        <MetricGrid layout="columns">
          <Metric label="reviewed records" value="42" />
          <Metric label="open requests" value="6" />
          <Metric label="median review time" value="8 min" />
        </MetricGrid>
        <Stack isCompact>
          <Subheading>Review queue</Subheading>
          <Text>Records awaiting a decision remain available below.</Text>
        </Stack>
      </PageContent>
      <CollectionToolbar label="Review controls" />
      <DataTable
        caption="Pending reviews"
        hideCaption
        rows={[
          { id: 'review-a', title: 'Release checklist', owner: 'Avery', waiting: '12 min' },
          { id: 'review-b', title: 'Documentation updates', owner: 'Morgan', waiting: '4 min' },
        ]}
        columns={[
          { id: 'title', label: 'Record', role: 'primary', cell: (record) => record.title },
          { id: 'owner', label: 'Owner', role: 'text', cell: (record) => record.owner },
          { id: 'waiting', label: 'Waiting', role: 'number', cell: (record) => record.waiting },
        ]}
        getRowId={(record) => record.id}
        empty="No pending reviews."
      />
    </>
  ),
};

export const NarrowReport: Story = {
  ...ReportWithRecords,
  globals: { viewport: { value: 'narrow', isRotated: false } },
};
