import * as stylex from '@stylexjs/stylex';
import { useEffect } from 'react';
import type { ComponentProps, ReactNode } from 'react';
import {
  CollectionToolbar,
  DataTable,
  DataTablePlaceholder,
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
import { SectionHeading } from '../../../core/src/index.ts';
import { AsyncRegion, Notice } from '../../../feedback/src/index.ts';
import { CollectionLayout, PageContent, PageLayout, Workbench } from '../../../layout/src/index.ts';

const styles = stylex.create({
  frame: { flex: '1 1 auto', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' },
  section: { minWidth: 0, display: 'flex', flexDirection: 'column' },
});

const editableTags = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const DEFAULT_PLACEHOLDER_ROWS = 8;

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.isContentEditable || editableTags.has(target.tagName);
}

export type CollectionStatus = 'loading' | 'ready' | 'failed';

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

type SharedCollectionProps<Row extends object> = SortableColumns<Row> & {
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
  readonly actions?: ReactNode;
  readonly notice?: ReactNode;
  readonly rowAction?: DataTableRowAction<Row> | undefined;
  readonly activeRowId?: string | undefined;
  readonly rowSizing?: 'fixed' | 'content' | undefined;
  readonly empty: ReactNode;
  readonly filteredEmpty?: ReactNode;
  /** Read lifecycle state: `'loading'` reserves geometry with `DataTablePlaceholder` inside `AsyncRegion`. */
  readonly status?: CollectionStatus;
  readonly failure?: ReactNode;
  readonly placeholderRows?: number;
};

export type CollectionPageProps<Row extends object> = SharedCollectionProps<Row> & {
  readonly navigation?: ComponentProps<typeof PageLayout>['navigation'];
  /** Optional right-hand inspector pane rendered inside a resizable Workbench split when open. */
  readonly inspector?: { readonly label: string; readonly content: ReactNode } | undefined;
  readonly inspectorInitialPercent?: number | undefined;
};

export type CollectionSectionProps<Row extends object> = SharedCollectionProps<Row> & {
  readonly id?: string;
  readonly meta?: ReactNode;
};

function useCollectionFrame<Row extends object>({
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
  rowAction,
  activeRowId,
  rowSizing,
  empty,
  filteredEmpty,
  status = 'ready',
  failure,
  placeholderRows = DEFAULT_PLACEHOLDER_ROWS,
  hasGlobalShortcuts,
}: SharedCollectionProps<Row> & { readonly hasGlobalShortcuts: boolean }) {
  const isLoading = status === 'loading';
  const isFailed = status === 'failed';
  const isReady = status === 'ready';

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
    isPlaceholder: isLoading,
    isReady,
  });

  const shouldBindShortcuts = hasGlobalShortcuts && isReady && query.search !== undefined;

  useEffect(() => {
    if (!shouldBindShortcuts) {
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
  }, [shouldBindShortcuts, openSearch]);

  const visibleRows = transformRows === undefined ? query.rows : transformRows(query.rows);
  const tableCaption = caption ?? title;
  const hasSearchCapability = typeof search === 'function';
  const hasFilterCapability = !('reason' in filters);

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

  const placeholder = (
    <DataTablePlaceholder
      caption={tableCaption}
      hideCaption
      columns={columns}
      rows={placeholderRows}
      {...(rowSizing !== undefined && { rowSizing })}
    />
  );

  const failureContent = failure ?? (
    <PageContent>
      <Notice hasError>Could not load {title.toLowerCase()}.</Notice>
    </PageContent>
  );

  const content = isLoading ? (
    <AsyncRegion state="pending" label={title} placeholder={placeholder} />
  ) : (
    <AsyncRegion state={isFailed ? 'failed' : 'ready'} label={title} placeholder={placeholder}>
      {isFailed ? failureContent : table}
    </AsyncRegion>
  );

  return {
    controlActions,
    chips,
    onKeyDown,
    content,
    frameProps: {
      search: hasSearchCapability ? (true as const) : search,
      filters: hasFilterCapability ? (true as const) : filters,
      isFiltered: query.isFiltered,
    },
  };
}

/**
 * Full-width collection page Lego block: wires `PageLayout`, top-bar search and filter controls (`/` and `⌘F`), active
 * filter chips, `AsyncRegion` + `DataTablePlaceholder` loading states, edge-to-edge `CollectionLayout`, and an optional
 * resizable `Workbench` inspector.
 */
export function CollectionPage<Row extends object>(props: CollectionPageProps<Row>): ReactNode {
  const { title, navigation, actions, notice, inspector, inspectorInitialPercent = 40 } = props;

  const { controlActions, chips, onKeyDown, content, frameProps } = useCollectionFrame({
    ...props,
    hasGlobalShortcuts: true,
  });

  const hasNotice = notice !== undefined && notice !== null;

  const headerActions = (
    <>
      {navigation === undefined && controlActions}
      {actions}
    </>
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
      {content}
    </CollectionLayout>
  );

  return (
    <TableQueryFrame {...frameProps}>
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

/**
 * Full-width collection section for tabbed or multi-section views. Wires `SectionHeading`, top-bar search and filters,
 * active filter chips, `AsyncRegion` loading placeholders, and edge-to-edge `DataTable`.
 */
export function CollectionSection<Row extends object>(props: CollectionSectionProps<Row>): ReactNode {
  const { id, title, meta, actions, notice } = props;

  const { controlActions, chips, onKeyDown, content, frameProps } = useCollectionFrame({
    ...props,
    hasGlobalShortcuts: false,
  });

  const hasNotice = notice !== undefined && notice !== null;

  return (
    <TableQueryFrame {...frameProps}>
      <section aria-label={title} {...stylex.props(styles.section)} onKeyDown={onKeyDown}>
        <SectionHeading
          {...(id !== undefined && { id })}
          title={title}
          meta={meta}
          actions={
            <>
              {controlActions}
              {actions}
            </>
          }
        />
        {hasNotice && <PageContent>{notice}</PageContent>}
        {chips !== false && <CollectionToolbar label="Applied filters">{chips}</CollectionToolbar>}
        {content}
      </section>
    </TableQueryFrame>
  );
}
