import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Row, SectionHeading, Stack } from '../../core/src/index.ts';
import { AsyncRegion, Notice } from '../../feedback/src/index.ts';
import { PageToolbar } from '../../layout/src/index.ts';
import { useCommandShortcuts } from '../../navigation/src/commands/index.ts';
import { PageNavigation } from '../../navigation/src/index.ts';
import { CollectionToolbar } from './collection-controls.tsx';
import { CollectionFilters } from './collection-filters.tsx';
import { DataTable, DataTablePlaceholder } from './data-table.tsx';
import type { DataTableColumn } from './data-table.tsx';
import { useCollectionControls } from './use-collection-controls.tsx';

type RecordRow = { readonly id: string; readonly name: string; readonly status: string };
type CollectionExampleProps = { readonly state?: 'ready' | 'pending' | 'failed'; readonly hasNavigation?: boolean };

const records = [
  { id: 'design', name: 'Design', status: 'active' },
  { id: 'engineering', name: 'Engineering', status: 'active' },
  { id: 'research', name: 'Research', status: 'archived' },
];

const columns = [
  { id: 'name', label: 'Project', role: 'primary', cell: (record) => record.name },
  { id: 'status', label: 'Status', role: 'status', cell: (record) => record.status },
] satisfies ReadonlyArray<DataTableColumn<RecordRow>>;

function CollectionExample({ state = 'ready', hasNavigation = false }: CollectionExampleProps): ReactNode {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [view, setView] = useState('projects');
  const region = useRef<HTMLDivElement>(null);

  const controls = useCollectionControls({
    search: { value: query, onChange: setQuery },
    filters: [
      {
        id: 'status',
        label: 'Status',
        value: status,
        defaultValue: 'all',
        onChange: setStatus,
        options: [
          { value: 'all', label: 'All statuses' },
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
        ],
      },
    ],
    isReady: state === 'ready',
  });

  useCommandShortcuts({
    target: region,
    isEnabled: state === 'ready',
    commands: [{ id: 'find-project', label: 'Find project', shortcut: { key: '/' }, onSelect: controls.openSearch }],
  });

  const rows = records.filter(
    (record) =>
      record.name.toLowerCase().includes(query.toLowerCase()) && (status === 'all' || status === record.status),
  );

  return (
    <div ref={region} onKeyDown={controls.onKeyDown}>
      <PageToolbar title="Projects" actions={!hasNavigation && controls.actions} showNavigation={false} />
      {hasNavigation && (
        <PageNavigation
          selectedId={view}
          onNavigate={setView}
          items={[
            { id: 'projects', label: 'Projects', href: '#projects' },
            { id: 'archive', label: 'Archive', href: '#archive' },
          ]}
          actions={controls.actions}
        />
      )}
      {controls.chips !== false && <CollectionToolbar label="Applied filters">{controls.chips}</CollectionToolbar>}
      {state === 'pending' ? (
        <AsyncRegion
          state="pending"
          label="Loading projects"
          placeholder={<DataTablePlaceholder caption="Records" columns={columns} />}
        />
      ) : (
        <AsyncRegion
          state={state}
          label="Loading projects"
          placeholder={<DataTablePlaceholder caption="Records" columns={columns} />}
        >
          {state === 'failed' ? (
            <Notice hasError>The application supplies its recovery action here.</Notice>
          ) : (
            <DataTable
              rows={rows}
              columns={columns}
              getRowId={(record) => record.id}
              caption="Projects"
              hideCaption
              empty="No projects match this view."
            />
          )}
        </AsyncRegion>
      )}
    </div>
  );
}

const meta = {
  title: 'Collections/Interactions',
  component: CollectionFilters,
  args: { groups: [] },
  parameters: {
    docs: {
      description: {
        component:
          'useCollectionControls owns search disclosure, filters, chips and focus. Applications supply values and callbacks and compose its actions with PageToolbar, SectionHeading or PageNavigation. Queries, routes and shortcut eligibility remain in the application. This example registers / only within its focus region. Filter controls render generic supplied icons and never interpret product statuses.',
      },
    },
  },
  render: () => <CollectionExample />,
} satisfies Meta<typeof CollectionFilters>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Collection: Story = {};
export const Navigation: Story = { render: () => <CollectionExample hasNavigation /> };
export const Pending: Story = { render: () => <CollectionExample hasNavigation state="pending" /> };
export const Failed: Story = { render: () => <CollectionExample hasNavigation state="failed" /> };

export const IndependentCollections: Story = {
  render: () => (
    <Stack>
      <CollectionExample />
      <SectionHeading title="Related projects" />
      <CollectionExample />
    </Stack>
  ),
};

function RetainedSearchExample(): ReactNode {
  const [isRefreshing, setRefreshing] = useState(false);

  return (
    <Stack>
      <Row>
        <Button onClick={() => setRefreshing(!isRefreshing)}>{isRefreshing ? 'Finish refresh' : 'Refresh'}</Button>
      </Row>
      <CollectionExample />
    </Stack>
  );
}

export const RetainedSearch: Story = { render: () => <RetainedSearchExample /> };
