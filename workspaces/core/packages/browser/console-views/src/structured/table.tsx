import { Text } from '@mechane-ai/elements';
import { DataTable } from '@mechane-ai/elements/collections';
import type { DataTableColumn } from '@mechane-ai/elements/collections';
import type { ReactNode } from 'react';

type TableRow = { readonly id: string; readonly cells: ReadonlyArray<string> };

export type PresentationTableProps = {
  readonly headers: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<ReadonlyArray<string>>;
  readonly caption?: string | null | undefined;
};

export function PresentationTable({ headers, rows, caption }: PresentationTableProps): ReactNode {
  const columns: ReadonlyArray<DataTableColumn<TableRow> & { readonly canSort: false }> = headers.map(
    (header, index) => ({
      id: String(index),
      label: header,
      role: 'text',
      canSort: false,
      shouldTruncate: false,
      cell: (row) => <Text>{row.cells[index] ?? 'Unavailable'}</Text>,
    }),
  );

  const records = rows.map((cells, index) => ({ id: String(index), cells }));

  return (
    <DataTable
      rows={records}
      columns={columns}
      getRowId={(row) => row.id}
      caption={caption ?? 'Result values'}
      hideCaption={caption === undefined || caption === null}
      rowSizing="content"
      empty="No values"
    />
  );
}
