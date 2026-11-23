import { byCell, createChange, createGridFocus, createSelection, definePrimitive, selects } from '@ui-sdk/core';
import type { ChangeDetails, GridCell } from '@ui-sdk/core';
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType, ReactNode } from 'react';
import type { CollectionPaginationProps } from './collection-controls.tsx';

export type DataTableSort = { readonly columnId: string; readonly direction: 'ascending' | 'descending' };

/** Why the sort wants to change: a press on a header, or a call such as an agent's step. */
export type DataTableSortDetails = ChangeDetails<'trigger-press' | 'imperative'>;

/** Why the selection wants to change: a press on a row's checkbox or on the one for every row, or a call. */
export type DataTableSelectionDetails = ChangeDetails<'item-press' | 'imperative'>;

export type TableResultStatus = 'ready' | 'pending' | 'failed';

export type TableResultOptions = {
  readonly status: TableResultStatus;
  readonly sort: DataTableSort | null;
  readonly onSortChange: ((sort: DataTableSort | null, details: DataTableSortDetails) => void) | undefined;
  /** The columns the application's query can order by. */
  readonly sortable: ReadonlyArray<{ readonly id: string; readonly label: string }>;
  /** The selected row IDs, or null for a table without selection. */
  readonly selected: ReadonlyArray<string> | null;
  readonly onSelectedChange: ((selected: Array<string>, details: DataTableSelectionDetails) => void) | undefined;
  readonly pagination: CollectionPaginationProps | undefined;
  /** Every supplied row's ID in the supplied order, including rows a window has not rendered. */
  readonly rowIds: ReadonlyArray<string>;
  /** A row's name from its data, for a row a window has not rendered. */
  readonly rowLabel: (row: number) => string | undefined;
  /** Whether each row has an action a reader can use now. */
  readonly isActionable: boolean;
  /** Brings a row a window has not rendered into view. */
  readonly reveal: (row: number) => void;
  /** Uses a row's action as a press does. */
  readonly onOpen: (row: number) => void;
  readonly isPlaceholder: boolean;
};

function resultState({ status, sort, selected, pagination, isPlaceholder }: TableResultOptions) {
  return {
    status,
    pending: status === 'pending',
    sort,
    selected: selected === null ? [] : [...selected],
    page: pagination?.description ?? null,
    hasPreviousPage: pagination !== undefined && !pagination.previous.disabled,
    hasNextPage: pagination !== undefined && !pagination.next.disabled,
    isPlaceholder,
  };
}

type ResultState = ReturnType<typeof resultState> & { readonly active: GridCell | null };

const privateContent = '[hidden], [inert], [aria-hidden="true"], [data-agent-hidden], [data-agent-secret]';

/** The rendered rows by ID, each with the name a reader sees, or null for a row whose name is private. */
function renderedRecords(table: HTMLElement | null | undefined): ReadonlyMap<string, string | null> | undefined {
  const body = table instanceof HTMLTableElement ? table.tBodies[0] : undefined;

  if (body === undefined || body.closest(privateContent) !== null) {
    return undefined;
  }

  return new Map(
    Array.from(body.rows).flatMap((row): Array<[string, string | null]> => {
      const value = row.dataset['rowId'];
      const cell = Array.from(row.cells).find((element) => element.dataset['recordLabel'] !== undefined);

      if (value === undefined || cell === undefined) {
        return [];
      }

      const isCellPrivate =
        cell.closest(privateContent) !== null ||
        cell.querySelector('[data-agent-secret], [data-agent-hidden]') !== null;

      if (isCellPrivate || !cell.checkVisibility({ visibilityProperty: true })) {
        return [[value, null]];
      }

      const source = cell.querySelector('[data-row-action][aria-label]') ?? cell.querySelector('[data-record-text]');
      const isSourcePrivate = source !== null && source.closest(privateContent) !== null;

      if (isSourcePrivate || source?.checkVisibility({ visibilityProperty: true }) === false) {
        return [[value, null]];
      }

      const label = source?.getAttribute('aria-label') ?? source?.textContent.trim();

      return [[value, label === undefined || label.length === 0 ? value : label]];
    }),
  );
}

const nextDirection = { none: 'ascending', ascending: 'descending', descending: 'none' } as const;
const sortDirections: ReadonlySet<unknown> = new Set(['ascending', 'descending']);
const rowEdges: ReadonlySet<string> = new Set(['Home', 'End']);

const collectionResults = definePrimitive({
  name: 'collection-results',
  options: {
    status: 'string',
    sort: 'value',
    onSortChange: 'callback',
    sortable: 'list',
    selected: 'value',
    onSelectedChange: 'callback',
    pagination: 'value',
    rowIds: 'list',
    rowLabel: 'callback',
    isActionable: 'boolean',
    reveal: 'callback',
    onOpen: 'callback',
    isPlaceholder: 'boolean',
  },
  state: (options: TableResultOptions): ResultState => ({ ...resultState(options), active: null }),
  sync: resultState,
  controlled: ['status', 'sort', 'selected', 'page', 'hasPreviousPage', 'hasNextPage'],
  api: (context) => {
    const change = createChange(context);

    const grid = createGridFocus<ResultState>(context, {
      key: 'active',
      rows: () => context.options().rowIds.length,
      cols: () => 1,
      disabled: () => !context.options().isActionable,
      reveal: (cell) => context.options().reveal(cell.row),
    });

    const supplied = { rowIds: context.options().rowIds };

    // The Tab stop stays on its record when the application sorts, filters or pages the rows.
    context.onOptions((options) => {
      const active = grid.active();
      const id = active === null ? undefined : supplied.rowIds[active.row];

      supplied.rowIds = options.rowIds;

      if (active === null || options.rowIds[active.row] === id) {
        return;
      }

      const row = id === undefined ? -1 : options.rowIds.indexOf(id);

      context.store.set({ active: row === -1 ? null : { row, col: 0 } });
    });

    const selection = createSelection(context, {
      key: 'selected',
      set: (value, details) => change('selected', value, details),
      order: () => context.options().rowIds,
      multiple: () => true,
    });

    function requireSelection(): void {
      if (context.options().selected === null) {
        throw new Error('This table has no row selection.');
      }
    }

    function sortColumn(columnId: unknown): string {
      const { sortable } = context.options();
      const column = sortable.find((candidate) => candidate.id === columnId || candidate.label === columnId);

      if (column === undefined) {
        const names = sortable.map((candidate) => candidate.label).join(', ');

        throw new Error(names.length === 0 ? 'This table has no sortable column.' : `Sort by one of: ${names}.`);
      }

      return column.id;
    }

    function page(direction: 'previous' | 'next'): boolean {
      const move = context.options().pagination?.[direction];

      if (move === undefined || move.disabled) {
        throw new Error(`There is no ${direction} page.`);
      }

      move.onClick();

      return true;
    }

    return {
      grid,
      /** Moves between row actions: arrows by one row, Page Up and Page Down by ten, Home and End to the ends. */
      rowKeydown(event: KeyboardEvent) {
        if (event.shiftKey) {
          return;
        }

        const hasCommand = event.metaKey || event.ctrlKey;

        if (hasCommand || !rowEdges.has(event.key)) {
          grid.keydown(event);

          return;
        }

        event.preventDefault();
        grid.focus(
          { row: event.key === 'Home' ? 0 : context.options().rowIds.length - 1, col: 0 },
          { reason: 'list-navigation', event },
        );
      },
      /** Moves focus to a row's action, scrolling a row a window has not rendered into view first. */
      focusRow: (row: number) => grid.focus({ row, col: 0 }),
      /** Steps a column through ascending, descending and unsorted, as a press on its header does. */
      toggleSort(columnId: string, event: Event) {
        const { sort } = context.options();
        const direction = nextDirection[sort?.columnId === columnId ? sort.direction : 'none'];

        return change('sort', direction === 'none' ? null : { columnId, direction }, {
          reason: 'trigger-press',
          event,
        });
      },
      /** Adds or removes one row. With Shift it selects the range from the row chosen before. */
      toggleRow(id: string, event: Event | undefined) {
        const why = event === undefined ? { reason: 'item-press' as const } : { reason: 'item-press' as const, event };

        if (event instanceof MouseEvent && event.shiftKey) {
          selection.extend(id, why);
        } else {
          selection.toggle(id, why);
        }
      },
      /** Selects every supplied row, or none of them once they all are. Rows on other pages keep their state. */
      toggleAll(event: Event | undefined) {
        selection.toggleAll(event === undefined ? { reason: 'item-press' } : { reason: 'item-press', event });
      },
      /** Sorts by a column's ID or header text. The direction is `ascending`, `descending` or `none`. */
      sort(columnId: unknown, direction: unknown = 'ascending') {
        if (direction === 'none') {
          return change('sort', null, { reason: 'imperative' });
        }

        if (!sortDirections.has(direction)) {
          throw new Error('The direction is ascending, descending or none.');
        }

        return change(
          'sort',
          { columnId: sortColumn(columnId), direction: direction === 'descending' ? 'descending' : 'ascending' },
          { reason: 'imperative' },
        );
      },
      /** Selects exactly the named supplied rows. */
      select(ids: unknown) {
        requireSelection();

        const { rowIds } = context.options();
        const wanted = (Array.isArray(ids) ? ids : [ids]).map(String);
        const unknown = wanted.find((id) => !rowIds.includes(id));

        if (unknown !== undefined) {
          throw new Error(`No row "${unknown}" is in this table.`);
        }

        return change('selected', wanted, { reason: 'imperative' });
      },
      /** Uses a row's action, as a press on the row does. */
      open(id: unknown) {
        const row = context.options().rowIds.indexOf(String(id));

        if (row === -1 || !context.options().isActionable) {
          throw new Error(row === -1 ? `No row "${String(id)}" is in this table.` : 'The rows have no action now.');
        }

        context.options().onOpen(row);

        return true;
      },
      previousPage: () => page('previous'),
      nextPage: () => page('next'),
      /** Every supplied row an agent may read, named as a reader sees it. A private name hides unrendered rows too. */
      records() {
        const rendered = renderedRecords(context.element('root'));
        const { rowIds, rowLabel } = context.options();

        if (rendered === undefined) {
          return [];
        }

        const hasPrivate = Array.from(rendered.values()).includes(null);

        return rowIds.flatMap((value, row) => {
          const label = rendered.has(value) ? rendered.get(value) : rowLabel(row);
          const isHidden = !rendered.has(value) && hasPrivate;

          return isHidden || label === null || label === undefined ? [] : [{ value, label }];
        });
      },
    };
  },
  slots: (slot) => ({
    root: slot({}),
    trigger: slot<{ value: string; row: number; col: number }>({
      props: { value: 'string', row: 'number', col: 'number' },
      selects: selects({ active: byCell }),
      attrs: (state, { props, api }) => ({ tabindex: api.grid.tabIndex(state, props) }),
      on: {
        keydown: (event, { api }) => api.rowKeydown(event),
        focus: (event, { api, props }) => {
          api.grid.focus(props, { reason: 'item-press', event });
        },
      },
      bind: (el, { api, props }) => api.grid.bind(el, props),
    }),
  }),
  agent: {
    actions: ['sort', 'select', 'open', 'previousPage', 'nextPage'],
    items: (api) => api.records(),
    shown: (state) => !state.isPlaceholder,
  },
});

/** What a table's own controls call on its results. */
export type TableResultsApi = {
  readonly focusRow: (row: number) => boolean;
  readonly toggleSort: (columnId: string, event: Event) => boolean;
  readonly toggleRow: (id: string, event: Event | undefined) => void;
  readonly toggleAll: (event: Event | undefined) => void;
};

/** Creates a table's results and renders its `table` element, whose props can call the results. */
export function useTableResults(
  options: TableResultOptions,
  table: (api: TableResultsApi) => PartProps<'table'>,
): { readonly api: TableResultsApi; readonly element: ReactNode } {
  const results = usePrimitive(collectionResults, options);
  const element = usePart(results, 'root', {}, table(results.api), 'table');

  return { api: results.api, element };
}

type TriggerPart<Tag extends 'a' | 'button'> = ComponentType<
  Omit<PartProps<Tag>, 'id' | 'value'> & { readonly value: string; readonly row: number; readonly col: number }
>;

/** A row's link action, keyed by its row's ID. The rows' actions share one Tab stop. */
export const TableRowLink: TriggerPart<'a'> = createParts(collectionResults, { root: 'table', trigger: 'a' }).Trigger;

/** A row's button action, keyed by its row's ID. */
export const TableRowButton: TriggerPart<'button'> = createParts(collectionResults, {
  root: 'table',
  trigger: 'button',
}).Trigger;
