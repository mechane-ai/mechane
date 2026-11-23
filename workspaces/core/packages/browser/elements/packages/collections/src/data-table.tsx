import * as stylex from '@stylexjs/stylex';
import { useShortcut } from '@ui-sdk/react/shortcuts';
import { useRef } from 'react';
import type { ReactNode } from 'react';
import { SkeletonText } from '../../feedback/src/index.ts';
import { CollectionToolbar } from './collection-controls.tsx';
import type { CollectionFilter } from './collection-filters.tsx';
import { frameStyles } from './data-table-layout.tsx';
import type { DataTableColumnLayout } from './data-table-layout.tsx';
import { TableRows } from './data-table-rows.tsx';
import type { TableRowsProps } from './data-table-rows.tsx';
import { tableStyles as styles } from './data-table-styles.ts';
import type { CollectionSearch } from './query-controls.tsx';
import {
  checkTableQueryException,
  controlledTableControls,
  TableQueryFrame,
  useFrameTableQuery,
  useLocalTableQuery,
} from './table-query.tsx';
import type { LocalTableQuery, TableQuery } from './table-query.tsx';
import { useCollectionControls } from './use-collection-controls.tsx';

export type DataTablePlaceholderProps = Pick<
  DataTableProps<object>,
  'caption' | 'hideCaption' | 'hideHeaders' | 'rowSizing' | 'window' | 'footer'
> & {
  readonly columns: ReadonlyArray<
    DataTableColumnLayout & { readonly shouldTruncate?: boolean; readonly placeholder?: ReactNode }
  >;
  readonly rows?: number;
};

export function DataTablePlaceholder({
  columns,
  rows = 3,
  hideCaption = true,
  ...props
}: DataTablePlaceholderProps): ReactNode {
  const sizing = typeof props.window?.height === 'string' ? props.window.height : 'content';
  const positions = Array.from({ length: rows }, (_, index) => ({ id: String(index) }));

  const placeholders = columns.map(({ placeholder, ...column }) => ({
    ...column,
    cell: () => placeholder ?? <SkeletonText width="60%" />,
  }));

  return (
    <div aria-hidden inert {...stylex.props(frameStyles[sizing], styles.placeholder)}>
      <TableRows
        {...props}
        hideCaption={hideCaption}
        isPlaceholder
        rows={positions}
        getRowId={(position) => position.id}
        columns={placeholders}
        empty={null}
      />
    </div>
  );
}

export type DataTableProps<Row> = TableRowsProps<Row> &
  (
    | { readonly query: TableQuery<Row>; readonly onEndReached?: never; readonly pagination?: never }
    | { readonly query: Exclude<TableQuery<Row>, LocalTableQuery<Row>> }
  );

export function DataTable<Row extends object>({ query, ...table }: DataTableProps<Row>): ReactNode {
  switch (query.mode) {
    case 'local':
      if (table.onEndReached !== undefined || table.pagination !== undefined) {
        throw new Error('Local table queries require all rows. Use a controlled or frame query for a paged source.');
      }

      return <LocalTable query={query} table={table} />;
    case 'controlled':
      return (
        <QueriedTable
          table={{ ...table, filteredEmpty: table.filteredEmpty ?? table.empty }}
          {...controlledTableControls(query)}
        />
      );
    case 'frame':
      return <FrameTable table={table} />;
    case 'static':
      checkTableQueryException(query);

      return (
        <TableQueryFrame>
          <TableRows {...table} />
        </TableQueryFrame>
      );
  }
}

function FrameTable<Row extends object>({ table }: { table: TableRowsProps<Row> }): ReactNode {
  const isFiltered = useFrameTableQuery();

  return (
    <TableQueryFrame>
      <TableRows {...table} empty={isFiltered ? (table.filteredEmpty ?? 'No matching records.') : table.empty} />
    </TableQueryFrame>
  );
}

function LocalTable<Row extends object>({
  query,
  table,
}: {
  query: LocalTableQuery<Row>;
  table: TableRowsProps<Row>;
}): ReactNode {
  const { rows, search, filters, isFiltered } = useLocalTableQuery(table.rows, query);

  return <QueriedTable table={{ ...table, rows }} search={search} filters={filters} isFiltered={isFiltered} />;
}

function QueriedTable<Row extends object>({
  table,
  search,
  filters,
  isFiltered,
}: {
  table: TableRowsProps<Row>;
  search: CollectionSearch | undefined;
  filters: ReadonlyArray<CollectionFilter>;
  isFiltered: boolean;
}): ReactNode {
  const queryControls = useCollectionControls({
    ...(search !== undefined && { search }),
    filters,
    isReady: true,
    label: table.caption,
  });

  const region = useRef<HTMLDivElement>(null);

  const shortcutOptions = {
    description: `Find in ${table.caption}`,
    layer: region,
    when: () => {
      const root = region.current;

      if (root === null) {
        return false;
      }

      const active = root.ownerDocument.activeElement;

      if (
        active === null ||
        active.closest(
          '[data-native-find], textarea, select, input:not([data-view-find]), [contenteditable="true"], [role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]',
        ) !== null
      ) {
        return false;
      }

      return (
        active.closest('[data-table-query]') === root ||
        (active === root.ownerDocument.body &&
          root.ownerDocument.querySelectorAll('[data-view-find-trigger]').length === 1)
      );
    },
  };

  useShortcut(search === undefined ? null : '/', queryControls.openSearch, shortcutOptions);
  useShortcut(search === undefined ? null : 'mod+f', queryControls.openSearch, shortcutOptions);

  return (
    <TableQueryFrame>
      <div
        ref={region}
        data-table-query
        onKeyDown={queryControls.onKeyDown}
        {...stylex.props(frameStyles[typeof table.window?.height === 'string' ? table.window.height : 'content'])}
      >
        {(search !== undefined || filters.length > 0) && (
          <CollectionToolbar label={`${table.caption} controls`} actions={queryControls.actions}>
            {queryControls.chips}
          </CollectionToolbar>
        )}
        <TableRows {...table} empty={isFiltered ? (table.filteredEmpty ?? 'No matching records.') : table.empty} />
      </div>
    </TableQueryFrame>
  );
}
