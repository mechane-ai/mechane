import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download } from 'lucide-react';
import { BarChart, BarChartPlaceholder } from '../../charts/src/cartesian/index.ts';
import { CollectionToolbar, DataTable, Metric, MetricGrid } from '../../collections/src/index.ts';
import { SectionHeading } from '../../core/src/index.ts';
import { PageContent } from './page-content.tsx';
import { PageToolbar, ToolbarAction } from './page-toolbar.tsx';
import { ReportContent } from './report-content.tsx';

const meta = {
  title: 'Layout/PageContent',
  component: PageContent,
  subcomponents: { ReportContent },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'PageContent owns one inset and the rhythm between content sections inside an existing page. Related sections can stack without additional panels. Use the chart report prop for a self-contained report with one heading, summary and plot. Embedded charts use their ordinary frame within the containing region. Supply the same composition while loading. ReportContent owns one PageContent around its optional summary and keeps its breakdown full width. Pass summary content directly and omit it for a table-only section. Table cells own their inset within the containing task region. Use CollectionLayout for a primary collection filling available height, and DetailPage for a centered reading column. The application owns measures, populations, periods, formatting and read state.',
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
      </PageContent>
      <SectionHeading title="Review queue" />
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

function ActivityReport({ isLoading = false }: { readonly isLoading?: boolean }) {
  const report = {
    summary: (
      <MetricGrid>
        {isLoading ? (
          <Metric label="Completed operations" variant="headline" isLoading hasDetail />
        ) : (
          <Metric label="Completed operations" value="480" variant="headline" detail="Nov 1–3 · UTC" />
        )}
      </MetricGrid>
    ),
  };

  return (
    <ReportContent
      summary={
        <>
          {isLoading ? (
            <BarChartPlaceholder
              title="Daily completed operations"
              report={report}
              height={180}
              series={[
                { id: 'build', label: 'Build', tone: 'series1' },
                { id: 'publish', label: 'Publish', tone: 'series2' },
              ]}
            />
          ) : (
            <BarChart
              title="Daily completed operations"
              report={report}
              height={180}
              categories={[
                { id: 'day-1', label: 'November 1' },
                { id: 'day-2', label: 'November 2' },
                { id: 'day-3', label: 'November 3' },
              ]}
              series={[
                { id: 'build', label: 'Build', tone: 'series1', values: [100, 140, 120] },
                { id: 'publish', label: 'Publish', tone: 'series2', values: [20, 60, 40] },
              ]}
              mode="stacked"
              domain={[0, 200]}
              formatValue={(value) => value.toLocaleString()}
            />
          )}
        </>
      }
      breakdown={
        <DataTable
          caption="Completed operations by type"
          rows={[
            { id: 'build', label: 'Build', count: 360 },
            { id: 'publish', label: 'Publish', count: 120 },
          ]}
          columns={[
            { id: 'label', label: 'Type', role: 'primary', cell: (row) => row.label },
            { id: 'count', label: 'Completed', role: 'number', cell: (row) => row.count.toLocaleString() },
          ]}
          getRowId={(row) => row.id}
          empty="No completed operations."
        />
      }
    />
  );
}

export const ChartReport: Story = { render: () => <ActivityReport /> };
export const ChartReportLoading: Story = { render: () => <ActivityReport isLoading /> };

export const NarrowChartReport: Story = {
  ...ChartReport,
  globals: { viewport: { value: 'narrow', isRotated: false } },
};
