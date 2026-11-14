import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { useState } from 'react';
import { BarChart, BarChartPlaceholder } from '../../charts/src/cartesian/index.ts';
import { ChartSeriesMarker } from '../../charts/src/index.ts';
import { DataTable, DataTablePlaceholder, DataTableText } from '../../collections/src/index.ts';
import type { DataTableColumn } from '../../collections/src/index.ts';
import { Button, SectionHeading } from '../../core/src/index.ts';
import { AsyncRegion, EmptyState, Meter } from '../../feedback/src/index.ts';
import { Input, SelectControl } from '../../forms/src/index.ts';
import { CollectionLayout } from './collection-layout.tsx';
import { PageToolbar } from './page-toolbar.tsx';
import { ReportContent } from './report-content.tsx';

const records = Array.from({ length: 80 }, (_, index) => ({
  id: String(index),
  name: `Example record ${index + 1}`,
  count: index + 1,
}));

const columns = [
  { id: 'name', label: 'Record', role: 'primary', cell: (row) => row.name },
  { id: 'count', label: 'Count', role: 'number', cell: (row) => row.count },
] satisfies ReadonlyArray<DataTableColumn<(typeof records)[number]>>;

const styles = stylex.create({ frame: { height: '100dvh', display: 'flex', flexDirection: 'column', minHeight: 0 } });

const meta = {
  title: 'Layout/CollectionLayout',
  component: CollectionLayout,
  decorators: [
    (Story) => (
      <div {...stylex.props(styles.frame)}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Start with FullHeight for a primary searchable collection: the header owns its controls, and DataTable fills the available viewport. Start with ShortReport for a measure followed by finite full-width contributors: ReportContent owns the chart inset, and table cells own row insets. Pointer or keyboard row inspection highlights the supplied series without selecting or querying it. Omit summary for table-only sections. Use RecordPage for one record and its task navigation. The application prepares rows, query state, permissions and retained results. Loading and Failed show initial reads; a refresh keeps the ready composition mounted. Use ContentTabs for local panels, PageNavigation for destinations, and ViewStack when inactive content must stay mounted.',
      },
    },
  },
} satisfies Meta<typeof CollectionLayout>;

export default meta;
type Story = StoryObj;

type ReadState = 'ready' | 'pending' | 'failed' | 'empty';

function CollectionExample({ initialState = 'ready' }: { readonly initialState?: ReadState }) {
  const [state, setState] = useState(initialState);
  const [query, setQuery] = useState('');
  const rows = state === 'empty' ? [] : records.filter((row) => row.name.toLowerCase().includes(query.toLowerCase()));
  const placeholder = <DataTablePlaceholder columns={columns} sizing="fill" />;

  return (
    <CollectionLayout
      header={
        <PageToolbar
          title="Records"
          showNavigation={false}
          actions={
            <Input
              type="search"
              aria-label="Find records"
              placeholder="Find records…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          }
        />
      }
    >
      {state === 'pending' ? (
        <AsyncRegion state="pending" label="Loading records" placeholder={placeholder} />
      ) : (
        <AsyncRegion state={state === 'failed' ? 'failed' : 'ready'} label="Loading records" placeholder={placeholder}>
          {state === 'failed' ? (
            <EmptyState
              title="Records unavailable"
              action={<Button onClick={() => setState('ready')}>Retry records</Button>}
            />
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              getRowId={(row) => row.id}
              caption="Records"
              window={{ height: 'fill' }}
              empty="No matching records."
            />
          )}
        </AsyncRegion>
      )}
    </CollectionLayout>
  );
}

export const FullHeight: Story = { render: () => <CollectionExample /> };
export const Loading: Story = { render: () => <CollectionExample initialState="pending" /> };
export const Failed: Story = { render: () => <CollectionExample initialState="failed" /> };
export const Empty: Story = { render: () => <CollectionExample initialState="empty" /> };

const services = [
  { id: 'api', name: 'API', tone: 'series1', count: 60, values: [15, 20, 25] },
  { id: 'worker', name: 'Worker', tone: 'series2', count: 40, values: [10, 15, 15] },
] as const;

const periods = [
  { id: 'all', label: 'All services' },
  { id: 'api', label: 'API' },
  { id: 'worker', label: 'Worker' },
];

const categories = [
  { id: 'monday', label: 'Monday' },
  { id: 'tuesday', label: 'Tuesday' },
  { id: 'wednesday', label: 'Wednesday' },
];

type Service = (typeof services)[number];

function RecordReport({
  hasSummary = true,
  isPending = false,
}: {
  readonly hasSummary?: boolean;
  readonly isPending?: boolean;
}) {
  const [service, setService] = useState<string | null>('all');
  const [highlightedId, setHighlightedId] = useState<string>();
  const rows = services.filter((row) => service === 'all' || row.id === service);
  const series = rows.map((row) => ({ id: row.id, label: row.name, tone: row.tone, values: row.values }));

  const report = {
    meta: 'Monday–Wednesday · requests',
    seriesValues: Object.fromEntries(rows.map((row) => [row.id, isPending ? undefined : `${row.count} requests`])),
    actions: (
      <SelectControl
        label="Report service"
        items={periods.map((period) => ({ value: period.id, label: period.label }))}
        value={service}
        onValueChange={setService}
        density="compact"
      />
    ),
  };

  const reportColumns = [
    {
      id: 'name',
      label: 'Service',
      role: 'primary',
      cell: (row) => <DataTableText leading={<ChartSeriesMarker tone={row.tone} />}>{row.name}</DataTableText>,
    },
    { id: 'count', label: 'Requests', role: 'number', cell: (row) => row.count },
    {
      id: 'share',
      label: 'Share of all requests',
      role: 'number',
      cell: (row) => (
        <Meter
          label={`${row.name} share`}
          layout="inline"
          value={row.count}
          max={100}
          valueLabel={`${row.count}%`}
          tone={row.tone}
        />
      ),
    },
  ] satisfies ReadonlyArray<DataTableColumn<Service>>;

  const summary = hasSummary ? (
    isPending ? (
      <BarChartPlaceholder title="Requests by service" report={report} series={series} height={180} />
    ) : (
      <BarChart
        title="Requests by service"
        report={report}
        categories={categories}
        series={series}
        mode="stacked"
        domain={[0, 50]}
        formatValue={(value) => `${value} requests`}
        highlightedSeriesId={highlightedId}
        height={180}
      />
    )
  ) : undefined;

  const content = (
    <ReportContent
      summary={summary}
      breakdown={
        <>
          <SectionHeading title="Services" />
          {isPending ? (
            <DataTablePlaceholder columns={reportColumns} />
          ) : (
            <DataTable
              rows={rows}
              columns={reportColumns}
              getRowId={(row) => row.id}
              caption="Reported requests"
              hideCaption
              onRowHighlightChange={setHighlightedId}
              empty="No reported requests."
            />
          )}
        </>
      }
    />
  );

  if (isPending) {
    return <AsyncRegion state="pending" label="Loading service requests" placeholder={content} />;
  }

  return (
    <AsyncRegion state="ready" label="Loading service requests" placeholder={content}>
      {content}
    </AsyncRegion>
  );
}

export const ShortReport: Story = { render: () => <RecordReport /> };
export const PendingReport: Story = { render: () => <RecordReport isPending /> };
export const TableOnly: Story = { render: () => <RecordReport hasSummary={false} /> };
