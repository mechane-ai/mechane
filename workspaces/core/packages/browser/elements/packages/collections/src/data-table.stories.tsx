import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { FileCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Stack, Text } from '../../core/src/index.ts';
import { Input } from '../../forms/src/index.ts';
import { CollectionPagination, CollectionToolbar, ColumnControls, FilterChips } from './collection-controls.tsx';
import { DataTable, DataTableText } from './data-table.tsx';
import type { DataTableColumn, DataTableSort } from './data-table.tsx';

const styles = stylex.create({ search: { width: 280, maxWidth: '100%' } });

interface Run {
  readonly id: string;
  readonly name: string;
  readonly status: 'Complete' | 'Running';
  readonly tokens: number;
}

const runs: ReadonlyArray<Run> = [
  { id: 'training-a', name: 'Training / instruction tuning', status: 'Complete', tokens: 24_356 },
  { id: 'sampling-b', name: 'Sampling / evaluation', status: 'Running', tokens: 6218 },
  { id: 'training-c', name: 'Training / comparison', status: 'Complete', tokens: 18_701 },
];

const columns: ReadonlyArray<DataTableColumn<Run>> = [
  { id: 'name', label: 'Name', cell: (run) => run.name, sortable: true },
  { id: 'status', label: 'Status', cell: (run) => <Badge>{run.status}</Badge> },
  { id: 'tokens', label: 'Tokens', cell: (run) => run.tokens.toLocaleString('en-US'), align: 'end', sortable: true },
];

const displayColumns = columns.map(({ sortable: _sortable, ...column }) => column);

function PreparedRows() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DataTableSort>();
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [visible, setVisible] = useState<ReadonlySet<string>>(new Set(columns.map((column) => column.id)));

  const rows = useMemo(() => {
    const filtered = runs.filter((run) => run.name.toLowerCase().includes(query.toLowerCase()));

    if (sort === undefined) {
      return filtered;
    }

    return filtered.toSorted((first, second) => {
      const comparison =
        sort.columnId === 'tokens' ? first.tokens - second.tokens : first.name.localeCompare(second.name, 'en-US');

      return sort.direction === 'ascending' ? comparison : -comparison;
    });
  }, [query, sort]);

  return (
    <Stack compact>
      <CollectionToolbar
        label="Run controls"
        actions={
          <ColumnControls
            columns={columns.map((column) => ({
              id: column.id,
              label: column.label,
              visible: visible.has(column.id),
              required: column.id === 'name',
            }))}
            onVisibilityChange={(id, shown) => {
              const next = new Set(visible);

              if (shown) {
                next.add(id);
              } else {
                next.delete(id);
              }

              setVisible(next);
            }}
          />
        }
      >
        <Input
          aria-label="Search runs"
          value={query}
          onValueChange={setQuery}
          placeholder="Search runs…"
          xstyle={styles.search}
        />
      </CollectionToolbar>
      {query !== '' && (
        <FilterChips filters={[{ id: 'search', label: `Name: ${query}` }]} onRemove={() => setQuery('')} />
      )}
      <DataTable
        rows={rows}
        columns={columns.filter((column) => visible.has(column.id))}
        getRowId={(run) => run.id}
        caption="Runs — all results"
        empty="No runs match this search."
        rowAction={{ href: (run) => `#${run.id}`, label: (run) => `Open ${run.name}` }}
        sort={sort}
        onSortChange={setSort}
        selectedIds={selected}
        onSelectionChange={setSelected}
        selectionLabel={(run) => `Select ${run.name}`}
        footer={
          <CollectionPagination
            description={`${rows.length} results · ${selected.size} selected`}
            previous={{ disabled: true, onClick: () => undefined }}
            next={{ disabled: true, onClick: () => undefined }}
          />
        }
      />
    </Stack>
  );
}

const meta = {
  title: 'Collections/Data table',
  component: DataTable,
  subcomponents: { DataTableText, CollectionToolbar, FilterChips, ColumnControls, CollectionPagination },
  parameters: {
    docs: {
      description: {
        component:
          'Prepared records and stable IDs. The application owns filtering, sorting, pagination and selection. The table renders the supplied page, reports sort intent, and optionally windows those rows. Ordinary rows stay 48px high; use rowSizing="content" for multiline operational details or larger controls. DataTableText truncates primary and secondary strings beside an optional leading icon. Arbitrary composed cells own their text layout. rowAction puts a native link or button in the first primary cell and adds arrow-key navigation; supply a complete label for its pointer and keyboard tooltip. Other cell controls keep their own actions. Choose Table for custom semantic structures. Collection controls report supplied filter, visibility, and page intent without inventing a total. Inspect narrow tables through their named horizontal scroll region.',
      },
    },
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj;

export const Controlled: Story = { render: () => <PreparedRows /> };

export const Empty: Story = {
  render: () => (
    <DataTable
      rows={[]}
      columns={displayColumns}
      getRowId={(run) => run.id}
      caption="Runs — no results"
      empty="No runs match these filters."
    />
  ),
};

export const Windowed: Story = {
  render: () => (
    <DataTable
      rows={Array.from({ length: 1000 }, (_, index) => ({
        id: `sample-${index}`,
        name: `Evaluation sample ${index + 1}`,
        status: 'Complete' as const,
        tokens: 240 + index,
      }))}
      columns={displayColumns}
      getRowId={(run) => run.id}
      caption="1,000 prepared samples"
      empty="No samples"
      rowAction={{ href: (run) => `#${run.id}`, label: (run) => `Open ${run.name}` }}
      window={{ height: 360 }}
    />
  ),
};

export const LongLabels: Story = {
  render: () => (
    <DataTable
      rows={[
        {
          id: 'restore',
          name: 'Verify the restored repository and compare every recorded artifact against its immutable manifest',
          status: 'Complete',
          tokens: 128_456,
        },
        { id: 'short', name: 'Hi', status: 'Complete', tokens: 1 },
        {
          id: 'path',
          name: 'packages/production-verification/src/restore/checks/repository-artifact-integrity.ts',
          status: 'Running',
          tokens: 6218,
        },
      ]}
      columns={[
        {
          id: 'name',
          label: 'Evaluation name and source reference',
          width: 320,
          cell: (run) => (
            <DataTableText
              leading={<FileCheck size={20} />}
              secondary="Recorded against the repository’s current definition"
            >
              {run.name}
            </DataTableText>
          ),
        },
        {
          id: 'status',
          label: 'Latest recorded result',
          width: 128,
          truncate: false,
          cell: (run) => <Badge>{run.status}</Badge>,
        },
        {
          id: 'tokens',
          label: 'Tokens',
          width: 96,
          truncate: false,
          align: 'end',
          cell: (run) => run.tokens.toLocaleString('en-US'),
        },
      ]}
      rowAction={{ href: (run) => `#${run.id}`, label: (run) => `Open ${run.name}` }}
      getRowId={(run) => run.id}
      caption="Recorded runs with long titles"
      empty="No recorded runs"
    />
  ),
};

export const Narrow: Story = { ...LongLabels, globals: { viewport: { value: 'narrow', isRotated: false } } };

export const OperationalDetails: Story = {
  render: () => (
    <DataTable
      rowSizing="content"
      rows={[
        { id: 'complete', name: 'Release notes', detail: 'All records are available.', complete: true },
        {
          id: 'retry',
          name: 'Quarterly review',
          detail:
            'The source stopped responding before its last page arrived. Retry to continue from the saved position.',
          complete: false,
        },
      ]}
      columns={[
        { id: 'name', label: 'Import', width: 180, cell: (row) => row.name },
        { id: 'detail', label: 'Latest result', width: 320, cell: (row) => <Text>{row.detail}</Text> },
        { id: 'action', label: 'Action', width: 120, cell: (row) => <Button disabled={row.complete}>Retry</Button> },
      ]}
      getRowId={(row) => row.id}
      caption="Import health"
      empty="No imports."
    />
  ),
};
