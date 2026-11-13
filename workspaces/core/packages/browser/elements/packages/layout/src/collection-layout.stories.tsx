import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { DataTable } from '../../collections/src/index.ts';
import { ContentTabs } from '../../navigation/src/index.ts';
import { CollectionLayout } from './collection-layout.tsx';
import { PageToolbar } from './page-toolbar.tsx';
import { ReportContent } from './report-content.tsx';

const records = Array.from({ length: 80 }, (_, index) => ({
  id: String(index),
  name: `Example record ${index + 1}`,
  count: index + 1,
}));

const columns = [
  { id: 'name', label: 'Record', role: 'primary' as const, cell: (row: (typeof records)[number]) => row.name },
  { id: 'count', label: 'Count', role: 'number' as const, cell: (row: (typeof records)[number]) => row.count },
];

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
          'CollectionLayout reserves the available height for one table or collection. The header stays above its viewport. ReportContent instead lets the containing page scroll an optional inset summary and a content-sized breakdown together. Pass summary content directly; do not wrap it in PageContent. Omit summary for table-only sections so no empty inset is reserved. Table cells own the shared inset. ContentTabs mounts one independent collection at a time. Supply controlled selection and href for shareable sections.',
      },
    },
  },
} satisfies Meta<typeof CollectionLayout>;

export default meta;
type Story = StoryObj;

export const FullHeight: Story = {
  render: () => (
    <CollectionLayout header={<PageToolbar title="Records" showNavigation={false} />}>
      <ContentTabs
        label="Record sections"
        items={[
          {
            id: 'records',
            label: 'Records',
            content: (
              <DataTable
                rows={records}
                columns={columns}
                getRowId={(row) => row.id}
                caption="Records"
                window={{ height: 'fill' }}
                empty="No records."
              />
            ),
          },
          { id: 'summary', label: 'Summary', content: <ReportContent summary={<p>Eighty recorded entries.</p>} /> },
        ]}
      />
    </CollectionLayout>
  ),
};

function RecordReport({ hasSummary = true }: { readonly hasSummary?: boolean }) {
  return (
    <ReportContent
      summary={hasSummary && <p>Reported entries for this period.</p>}
      breakdown={
        <DataTable
          rows={records.slice(0, 6)}
          columns={columns}
          getRowId={(row) => row.id}
          caption="Reported entries"
          empty="No reported entries."
        />
      }
    />
  );
}

export const ShortReport: Story = { render: () => <RecordReport /> };
export const TableOnly: Story = { render: () => <RecordReport hasSummary={false} /> };
