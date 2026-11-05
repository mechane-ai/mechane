import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { FileCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Stack, Text } from '../../core/src/index.ts';
import { Input } from '../../forms/src/index.ts';
import { CollectionPagination, CollectionToolbar, ColumnControls, FilterChips } from './collection-controls.tsx';
import { DataTable, DataTablePlaceholder, DataTableText, DataTableTextPlaceholder } from './data-table.tsx';
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
  { id: 'name', label: 'Name', role: 'primary', cell: (run) => run.name, sortable: true },
  { id: 'status', label: 'Status', role: 'status', cell: (run) => <Badge>{run.status}</Badge> },
  { id: 'tokens', label: 'Tokens', role: 'number', cell: (run) => run.tokens.toLocaleString('en-US'), sortable: true },
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
    <>
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
        {query !== '' && (
          <FilterChips filters={[{ id: 'search', label: `Name: ${query}` }]} onRemove={() => setQuery('')} />
        )}
      </CollectionToolbar>
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
    </>
  );
}

const meta = {
  title: 'Collections/Data table',
  component: DataTable,
  subcomponents: {
    DataTableText,
    DataTableTextPlaceholder,
    DataTablePlaceholder,
    CollectionToolbar,
    FilterChips,
    ColumnControls,
    CollectionPagination,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Prepared records and stable IDs. The application owns filtering, sorting, pagination and selection. Every column declares a role: primary, text and status align at the start; number, timestamp and actions align at the end. Primary columns absorb remaining width. Numeric identifiers use text. Use width only for a concrete content need. Ordinary rows stay 48px high with primary and text strings truncated; use rowSizing="content" for multiline details or larger controls. DataTableText truncates primary and secondary strings beside an optional leading icon. Its trailing slot keeps a badge next to the primary label while the text truncates. DataTablePlaceholder reuses the supplied column roles, metadata and row sizing. DataTableTextPlaceholder shares the text cell geometry. Both are noninteractive decoration; AsyncRegion owns their visibility. Arbitrary composed cells own their text layout. rowAction puts a native link or button in the first visible primary cell and adds arrow-key navigation; supply a complete label for its tooltip. The table renders supplied order and reports sort intent. CollectionToolbar owns its 16px inset and separator, and omits an empty bar. Inspect narrow tables through their named horizontal scroll region.',
      },
    },
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj;

export const Controlled: Story = { render: () => <PreparedRows /> };

export const ColumnRoles: Story = {
  render: () => (
    <DataTable
      rows={[
        {
          id: '1042',
          name: 'Release checklist for production readiness and recorded artifact verification',
          status: 'Ready',
          count: 12,
          updated: 'Nov 4, 2026',
        },
        { id: '8', name: 'Quarterly plan', status: 'In review', count: 3, updated: 'Nov 3, 2026' },
      ]}
      columns={[
        {
          id: 'name',
          label: 'Name',
          role: 'primary',
          cell: (record) => (
            <DataTableText secondary={`Record ${record.id}`} trailing={<Badge>Automatic</Badge>}>
              {record.name}
            </DataTableText>
          ),
        },
        { id: 'identifier', label: 'Record ID', role: 'text', cell: (record) => record.id },
        { id: 'status', label: 'Status', role: 'status', cell: (record) => <Badge>{record.status}</Badge> },
        { id: 'count', label: 'Reviews', role: 'number', cell: (record) => record.count.toString() },
        { id: 'updated', label: 'Updated', role: 'timestamp', cell: (record) => record.updated },
        { id: 'actions', label: 'Actions', role: 'actions', cell: () => <Button>Review</Button> },
      ]}
      getRowId={(record) => record.id}
      caption="Records awaiting review"
      empty="No records await review."
    />
  ),
};

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
          role: 'primary',
          cell: (run) => (
            <DataTableText
              leading={<FileCheck size={20} />}
              secondary="Recorded against the repository’s current definition"
            >
              {run.name}
            </DataTableText>
          ),
        },
        { id: 'status', label: 'Latest recorded result', role: 'status', cell: (run) => <Badge>{run.status}</Badge> },
        { id: 'tokens', label: 'Tokens', role: 'number', cell: (run) => run.tokens.toLocaleString('en-US') },
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
        { id: 'name', label: 'Import', role: 'primary', cell: (row) => row.name },
        { id: 'detail', label: 'Latest result', role: 'text', width: 320, cell: (row) => <Text>{row.detail}</Text> },
        {
          id: 'action',
          label: 'Action',
          role: 'actions',
          cell: (row) => <Button disabled={row.complete}>Retry</Button>,
        },
      ]}
      getRowId={(row) => row.id}
      caption="Import health"
      empty="No imports."
    />
  ),
};

export const Placeholder: Story = { render: () => <DataTablePlaceholder columns={columns} /> };

export const TextPlaceholder: Story = {
  render: () => (
    <Stack>
      <DataTableText leading={<FileCheck size={16} />} secondary="Recorded summary">
        Release review
      </DataTableText>
      <DataTableTextPlaceholder leading={<FileCheck size={16} />} secondary />
    </Stack>
  ),
};
