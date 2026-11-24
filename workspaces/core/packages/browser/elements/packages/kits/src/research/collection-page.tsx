import * as stylex from '@stylexjs/stylex';
import { useEffect } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
  CollectionToolbar,
  DataTable,
  TableQueryFrame,
  useCollectionControls,
  useLocalTableQuery,
} from '../../../collections/src/index.ts';
import type {
  DataTableColumn,
  DataTableRowAction,
  DataTableSort,
  DataTableSortDetails,
  TableFilterDimension,
  TableQueryException,
} from '../../../collections/src/index.ts';
import { CollectionLayout, PageContent, PageLayout, Workbench } from '../../../layout/src/index.ts';

const styles = stylex.create({
  frame: { flex: '1 1 auto', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' },
});

const editableTags = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || editableTags.has(target.tagName);
}

type SortableColumns<Row> =
  | {
      readonly columns: ReadonlyArray<DataTableColumn<Row>>;
      readonly sort: DataTableSort | undefined;
      readonly onSortChange: (sort: DataTableSort | undefined, details: DataTableSortDetails) => void;
    }
  | {
      readonly columns: ReadonlyArray<DataTableColumn<Row> & { readonly canSort?: false }>;
      readonly sort?: never;
      readonly onSortChange?: never;
    };

export type CollectionPageProps<Row extends object> = SortableColumns<Row> & {
  readonly title: string;
  readonly caption?: string;
  readonly rows: ReadonlyArray<Row>;
  readonly getRowId: (row: Row) => string;
  /** Local full-text search accessor, or an explicit exception reason when search is omitted. */
  readonly search: ((row: Row) => string) | TableQueryException;
  /** Local filter dimensions rendered in the top toolbar filter menu, or an explicit exception reason. */
  readonly filters: ReadonlyArray<TableFilterDimension<Row>> | TableQueryException;
  /** Optional custom row transformer (e.g. sorting) applied after local search and filtering. */
  readonly transformRows?: (rows: ReadonlyArray<Row>) => ReadonlyArray<Row>;
  readonly navigation?: ComponentProps<typeof PageLayout>['navigation'];
  readonly actions?: ReactNode;
  readonly notice?: ReactNode;
  readonly rowAction?: DataTableRowAction<Row> | undefined;
  readonly activeRowId?: string | undefined;
  readonly rowSizing?: 'fixed' | 'content' | undefined;
  readonly empty: ReactNode;
  readonly filteredEmpty?: ReactNode;
  /** Optional right-hand inspector pane rendered inside a resizable Workbench split when open. */
  readonly inspector?: { readonly label: string; readonly content: ReactNode } | undefined;
  readonly inspectorInitialPercent?: number | undefined;
};

/**
 * Full-width collection page Lego block: wires `PageLayout`, top-bar search and filter controls (`/` and `⌘F`), active
 * filter chips, edge-to-edge `CollectionLayout` + `DataTable`, and an optional resizable `Workbench` inspector.
 */
export function CollectionPage<Row extends object>({
  title,
  caption,
  rows,
  getRowId,
  columns,
  sort,
  onSortChange,
  search,
  filters,
  transformRows,
  navigation,
  actions,
  notice,
  rowAction,
  activeRowId,
  rowSizing,
  empty,
  filteredEmpty,
  inspector,
  inspectorInitialPercent = 40,
}: CollectionPageProps<Row>): ReactNode {
  const query = useLocalTableQuery(rows, { mode: 'local', search, filters });

  const {
    actions: controlActions,
    chips,
    onKeyDown,
    openSearch,
  } = useCollectionControls({
    label: `${title} controls`,
    ...(query.search !== undefined && { search: query.search }),
    filters: query.filters,
    isReady: true,
  });

  const hasSearch = query.search !== undefined;

  useEffect(() => {
    if (!hasSearch) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent): void {
      const isSlash = event.key === '/' && !isEditableElement(event.target);
      const isModF = event.key.toLowerCase() === 'f' && (event.metaKey || event.ctrlKey);

      if (isSlash || isModF) {
        event.preventDefault();
        openSearch();
      }
    }

    globalThis.addEventListener('keydown', handleKeyDown);

    return () => globalThis.removeEventListener('keydown', handleKeyDown);
  }, [hasSearch, openSearch]);

  const visibleRows = transformRows === undefined ? query.rows : transformRows(query.rows);
  const tableCaption = caption ?? title;
  const hasSearchCapability = typeof search === 'function';
  const hasFilterCapability = !('reason' in filters);
  const hasNotice = notice !== undefined && notice !== null;

  const headerActions = (
    <>
      {navigation === undefined && controlActions}
      {actions}
    </>
  );

  const sharedTableProps = {
    caption: tableCaption,
    hideCaption: true,
    rows: visibleRows,
    getRowId,
    query: { mode: 'frame' as const },
    ...(rowAction !== undefined && { rowAction }),
    ...(activeRowId !== undefined && { activeRowId }),
    ...(rowSizing !== undefined && { rowSizing }),
    empty,
    ...(filteredEmpty !== undefined && { filteredEmpty }),
  };

  const table =
    onSortChange === undefined ? (
      <DataTable {...sharedTableProps} columns={columns} />
    ) : (
      <DataTable {...sharedTableProps} columns={columns} sort={sort} onSortChange={onSortChange} />
    );

  const body = (
    <CollectionLayout
      header={
        <>
          {hasNotice && <PageContent>{notice}</PageContent>}
          {chips !== false && <CollectionToolbar label="Applied filters">{chips}</CollectionToolbar>}
        </>
      }
    >
      {table}
    </CollectionLayout>
  );

  return (
    <TableQueryFrame
      search={hasSearchCapability ? true : search}
      filters={hasFilterCapability ? true : filters}
      isFiltered={query.isFiltered}
    >
      <section {...stylex.props(styles.frame)} onKeyDown={onKeyDown}>
        <PageLayout title={title} actions={headerActions} navigation={navigation}>
          {inspector === undefined ? (
            body
          ) : (
            <Workbench isResizable inspectorInitialPercent={inspectorInitialPercent} inspector={inspector}>
              {body}
            </Workbench>
          )}
        </PageLayout>
      </section>
    </TableQueryFrame>
  );
}
