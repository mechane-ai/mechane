import { Button } from '@mechane-ai/elements';
import { DataTable } from '@mechane-ai/elements/collections';
import type { DataTableColumn, DataTableSort } from '@mechane-ai/elements/collections';
import { Notice } from '@mechane-ai/elements/feedback';
import { PageLayout } from '@mechane-ai/elements/layout';

export type Worker = { readonly id: string; readonly name: string; readonly status: string };

export type WorkerQuery = {
  readonly text: string;
  readonly status: string;
  readonly page: number;
  readonly sort: DataTableSort | undefined;
};

type WorkerPage = { readonly rows: ReadonlyArray<Worker>; readonly number: number; readonly hasNext: boolean };

export type WorkerRead =
  | { readonly status: 'ready'; readonly page: WorkerPage }
  | { readonly status: 'pending' | 'failed'; readonly page?: WorkerPage };

type CollectionProps = {
  readonly query: WorkerQuery;
  readonly result: WorkerRead;
  readonly onQueryChange: (query: WorkerQuery) => void;
  readonly onRetry: () => void;
  readonly workerHref: (worker: Worker) => string;
  readonly onOpen?: (worker: Worker) => void;
};

const columns = [
  { id: 'name', label: 'Worker', role: 'primary', canSort: true, cell: (worker) => worker.name },
  { id: 'status', label: 'Status', role: 'status', cell: (worker) => worker.status },
] satisfies ReadonlyArray<DataTableColumn<Worker>>;

/**
 * Build a searchable, filterable server-paged table with record links. Keep query state in the route and retain the
 * previous page during refresh. The server authorizes, filters and sorts the collection before paging.
 */
export function SearchableCollection({ query, result, onQueryChange, onRetry, workerHref, onOpen }: CollectionProps) {
  const page = result.page;
  const isPending = result.status === 'pending';
  const isReady = result.status === 'ready';
  const hasResults = page !== undefined;

  return (
    <PageLayout title="Workers" showNavigation={false}>
      {isPending && <Notice>Loading workers…</Notice>}
      {result.status === 'failed' && (
        <Notice hasError>
          Could not load workers. <Button onClick={onRetry}>Retry</Button>
        </Notice>
      )}
      <DataTable
        caption="Workers"
        hideCaption
        columns={columns}
        rows={page?.rows ?? []}
        getRowId={(worker) => worker.id}
        resultStatus={result.status}
        query={{
          mode: 'controlled',
          search: {
            label: 'Find workers',
            value: query.text,
            onChange: (text) => onQueryChange({ ...query, text, page: 1 }),
          },
          filters: [
            {
              id: 'status',
              label: 'Status',
              defaultValue: '',
              value: query.status,
              options: [
                { value: '', label: 'All statuses' },
                { value: 'Available', label: 'Available' },
                { value: 'Busy', label: 'Busy' },
              ],
              onChange: (status) => onQueryChange({ ...query, status, page: 1 }),
            },
          ],
        }}
        sort={query.sort}
        onSortChange={(sort) => onQueryChange({ ...query, sort, page: 1 })}
        rowAction={{
          label: (worker) => `Open ${worker.name}`,
          href: workerHref,
          ...(onOpen !== undefined && { onActivate: onOpen }),
        }}
        pagination={{
          description: hasResults ? `Page ${page.number}` : '',
          previous: {
            disabled: !isReady || query.page <= 1,
            onClick: () => onQueryChange({ ...query, page: query.page - 1 }),
          },
          next: {
            disabled: !isReady || page?.hasNext !== true,
            onClick: () => onQueryChange({ ...query, page: query.page + 1 }),
          },
        }}
        empty={isReady && 'No workers yet.'}
        filteredEmpty={isReady && 'No workers match your search or filters.'}
      />
    </PageLayout>
  );
}
