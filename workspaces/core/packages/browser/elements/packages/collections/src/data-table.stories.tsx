import type { Meta, StoryObj } from '@storybook/react-vite';
import * as stylex from '@stylexjs/stylex';
import { FileCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge, Button, Stack, Text } from '../../core/src/index.ts';
import { Input } from '../../forms/src/index.ts';
import { CollectionPagination, CollectionToolbar, DisplayOptions, FilterChips } from './collection-controls.tsx';
import { DataTable, DataTablePlaceholder, DataTableText, DataTableTextPlaceholder } from './data-table.tsx';
import type { DataTableColumn, DataTableSort } from './data-table.tsx';
import { ListFooter } from './list-footer.tsx';

const styles = stylex.create({
  search: { width: 280, maxWidth: '100%' },
  fillFrame: { display: 'flex', flexDirection: 'column', height: 360, minWidth: 0 },
});

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
  { id: 'name', label: 'Name', role: 'primary', cell: (run) => run.name, canSort: true },
  { id: 'status', label: 'Status', role: 'status', cell: (run) => <Badge>{run.status}</Badge> },
  { id: 'tokens', label: 'Tokens', role: 'number', cell: (run) => run.tokens.toLocaleString('en-US'), canSort: true },
];

const displayColumns = columns.map(({ canSort: _sortable, ...column }) => column);

const emptyColumns = [
  ...displayColumns,
  { id: 'identifier', label: 'Run ID', role: 'text', isSecondary: true, cell: (run) => run.id },
  { id: 'updated', label: 'Updated', role: 'timestamp', cell: () => 'Nov 13, 2026' },
  { id: 'actions', label: 'Actions', role: 'actions', cell: () => <Button>Review</Button> },
] satisfies ReadonlyArray<DataTableColumn<Run>>;

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
          <DisplayOptions
            options={columns.map((column) => ({
              id: column.id,
              label: column.label,
              isChecked: visible.has(column.id),
              isRequired: column.id === 'name',
            }))}
            onChange={(id, shown) => {
              const next = new Set(visible);

              if (shown) {
                next.add(id);
              } else {
                next.delete(id);
              }

              setVisible(next);
            }}
            onReset={() => setVisible(new Set(columns.map((column) => column.id)))}
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
    DisplayOptions,
    CollectionPagination,
    ListFooter,
  },
  parameters: {
    docs: {
      description: {
        component:
          'Prepared records and stable IDs. The application owns filtering, sorting, pagination and selection. Every column declares a role: primary, text and status align at the start; number, timestamp and actions align at the end. Primary columns absorb remaining width. Numeric identifiers use text. Use width only for a concrete content need. Ordinary rows stay 48px high with primary and text strings truncated; use rowSizing="content" for multiline details or larger controls. DataTableText truncates primary and secondary strings beside an optional leading icon. Its trailing slot keeps a badge next to the primary label while the text truncates. DataTablePlaceholder reuses the supplied column roles, metadata and row sizing. DataTableTextPlaceholder shares the text cell geometry. Both are noninteractive decoration; AsyncRegion owns their visibility. Arbitrary composed cells own their text layout. rowAction stretches the first visible primary cell’s native link or button across noninteractive cells and adds arrow-key navigation; supply a complete label for its tooltip. Links retain native modifier and middle clicks. Button row actions accept disabled for unavailable operations. onRowHighlightChange reports pointer or keyboard inspection by stable row ID, independently of activeRowId and selection. Keyboard focus takes over from an earlier hover; leaving the table restores its focused row. Use focusRowId to return to the shared primary action after inspection. Embedded controls and selection stay independent. The table renders supplied order and reports sort intent. CollectionToolbar owns its 16px inset and separator, and omits an empty bar. DisplayOptions reports supplied choices through one icon menu, disables required choices, and invokes the application’s reset callback. Apply the choices to the rendered columns; the control does not transform records. CollectionPagination supplies previous and next buttons. Use ListFooter for a result summary with application-defined cursor actions. A cursor does not imply a page count. Inspect narrow tables through their named horizontal scroll region.',
      },
    },
  },
} satisfies Meta<typeof DataTable>;

export default meta;
type Story = StoryObj;

export const Controlled: Story = { render: () => <PreparedRows /> };

function LinkedInspection() {
  const [highlightedId, setHighlightedId] = useState<string>();
  const [activeId, setActiveId] = useState<string>();
  const [focusRowId, setFocusRowId] = useState<string>();
  const [isDisabled, setDisabled] = useState(false);

  return (
    <Stack>
      <Text>
        Highlighted: {highlightedId ?? 'none'} · Inspected: {activeId ?? 'none'}
      </Text>
      <Button onClick={() => setDisabled(!isDisabled)}>
        {isDisabled ? 'Enable inspection' : 'Disable inspection'}
      </Button>
      {activeId !== undefined && (
        <Button
          onClick={() => {
            setFocusRowId(activeId);
            setActiveId(undefined);
          }}
        >
          Return to inspected row
        </Button>
      )}
      <DataTable
        rows={runs}
        columns={displayColumns}
        getRowId={(run) => run.id}
        caption="Runs with linked inspection"
        empty="No runs."
        activeRowId={activeId}
        focusRowId={focusRowId}
        onRowHighlightChange={setHighlightedId}
        rowAction={{
          label: (run) => `Inspect ${run.name}`,
          disabled: isDisabled,
          onActivate: (run) => {
            setFocusRowId(undefined);
            setActiveId(run.id);
          },
        }}
      />
    </Stack>
  );
}

export const RowInspection: Story = { render: () => <LinkedInspection /> };

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
      rowAction={{ href: (record) => `#${record.id}`, label: (record) => `Open ${record.name}` }}
      caption="Records awaiting review"
      empty="No records await review."
    />
  ),
};

export const Empty: Story = {
  parameters: {
    docs: {
      description: { story: 'Empty feedback wraps to the table viewport and stays visible while wide columns scroll.' },
    },
  },
  render: () => (
    <DataTable
      rows={[]}
      columns={emptyColumns}
      getRowId={(run) => run.id}
      caption="Runs — no results"
      empty="No runs match these filters. Clear a filter or choose another date range to see recorded runs."
    />
  ),
};

export const EmptyFill: Story = {
  render: () => (
    <div {...stylex.props(styles.fillFrame)}>
      <DataTable
        rows={[]}
        columns={emptyColumns}
        getRowId={(run) => run.id}
        caption="Runs — empty collection"
        empty={
          <Stack>
            <Text>No runs match these filters.</Text>
            <Text>Clear a filter or choose another date range to see recorded runs.</Text>
          </Stack>
        }
        window={{ height: 'fill' }}
      />
    </div>
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
              leading={<FileCheck size={16} />}
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
      <DataTableTextPlaceholder leading={<FileCheck size={16} />} isSecondary />
      <DataTableText leading={null} trailing={false}>
        No adornment
      </DataTableText>
      <DataTableTextPlaceholder leading={false} />
    </Stack>
  ),
};

export const CursorStates: Story = {
  render: () => (
    <Stack>
      <ListFooter
        actions={
          <>
            <Button disabled>Previous</Button>
            <Button>Next</Button>
          </>
        }
      >
        First page
      </ListFooter>
      <ListFooter
        actions={
          <>
            <Button>Previous</Button>
            <Button disabled>Next</Button>
          </>
        }
      >
        Last recorded page
      </ListFooter>
    </Stack>
  ),
};
