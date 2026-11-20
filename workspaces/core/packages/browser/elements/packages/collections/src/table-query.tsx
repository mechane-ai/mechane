import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { CollectionFilter } from './collection-filters.tsx';
import type { CollectionSearch } from './query-controls.tsx';

export type TableQueryException = { readonly reason: string };

export type TableFilterDimension<Row> = {
  readonly id: string;
  readonly label: string;
  readonly value: (row: Row) => string;
  readonly formatLabel?: (value: string) => string;
};

export type LocalTableQuery<Row> = {
  readonly mode: 'local';
  readonly search: ((row: Row) => string) | TableQueryException;
  readonly filters: ReadonlyArray<TableFilterDimension<Row>> | TableQueryException;
};

type ControlledTableQuery = {
  readonly mode: 'controlled';
  readonly search: CollectionSearch | TableQueryException;
  readonly filters: ReadonlyArray<CollectionFilter> | TableQueryException;
};

export type TableQuery<Row> =
  | LocalTableQuery<Row>
  | ControlledTableQuery
  | { readonly mode: 'frame' }
  | ({ readonly mode: 'static' } & TableQueryException);

type FrameCapability = true | TableQueryException;
const QueryFrame = createContext<boolean | undefined>(undefined);

export function checkTableQueryException(exception: TableQueryException) {
  if (exception.reason.trim().length === 0) {
    throw new Error('A table query exception requires a reason.');
  }
}

type QueryFrameProps = { readonly children: ReactNode } & (
  | { readonly search: FrameCapability; readonly filters: FrameCapability; readonly isFiltered?: boolean }
  | { readonly search?: never; readonly filters?: never; readonly isFiltered?: never }
);

export function TableQueryFrame({ search, filters, children, isFiltered = false }: QueryFrameProps): ReactNode {
  if (search === undefined) {
    return <QueryFrame value={undefined}>{children}</QueryFrame>;
  }

  if (search !== true) {
    checkTableQueryException(search);
  }

  if (filters !== true) {
    checkTableQueryException(filters);
  }

  return <QueryFrame value={isFiltered}>{children}</QueryFrame>;
}

function checkFilters(filters: ReadonlyArray<{ readonly id: string }> | TableQueryException) {
  if ('reason' in filters) {
    checkTableQueryException(filters);

    return;
  }

  if (filters.length === 0) {
    throw new Error('Supply filter dimensions or explain why the table has none.');
  }

  if (new Set(filters.map((group) => group.id)).size !== filters.length) {
    throw new Error('Each table filter must have a unique ID.');
  }
}

const noDimensions: ReadonlyArray<never> = [];

type LocalFilter = Omit<CollectionFilter, 'icon' | 'options'> & {
  readonly options: ReadonlyArray<{ readonly label: string; readonly value: string }>;
};

type LocalResult<Row, Search> = {
  readonly rows: ReadonlyArray<Row>;
  readonly search: Search;
  readonly filters: ReadonlyArray<LocalFilter>;
  readonly isFiltered: boolean;
};

export function useLocalTableQuery<Row>(
  rows: ReadonlyArray<Row>,
  query: LocalTableQuery<Row> & { readonly search: (row: Row) => string },
): LocalResult<Row, CollectionSearch>;
export function useLocalTableQuery<Row>(
  rows: ReadonlyArray<Row>,
  query: LocalTableQuery<Row>,
): LocalResult<Row, CollectionSearch | undefined>;
export function useLocalTableQuery<Row>(
  rows: ReadonlyArray<Row>,
  query: LocalTableQuery<Row>,
): LocalResult<Row, CollectionSearch | undefined> {
  const [text, setText] = useState('');
  const [choices, setChoices] = useState<ReadonlyMap<string, string>>(new Map());
  const searchText = typeof query.search === 'function' ? query.search : undefined;

  if (typeof query.search !== 'function') {
    checkTableQueryException(query.search);
  }

  checkFilters(query.filters);

  const dimensions = 'reason' in query.filters ? noDimensions : query.filters;
  const search = searchText === undefined ? undefined : { value: text, onChange: setText };
  const needle = text.trim().toLowerCase();

  const filters = useMemo(
    () =>
      dimensions.map((dimension): LocalFilter => {
        const values = new Set(rows.map(dimension.value));
        const selected = choices.get(dimension.id);

        if (selected !== undefined) {
          values.add(selected);
        }

        const options = Array.from(values, (value) => ({
          value: `value:${value}`,
          label: dimension.formatLabel?.(value) ?? (value === '' ? 'Unspecified' : value),
        }));

        return {
          id: dimension.id,
          label: dimension.label,
          options: [{ value: '', label: 'All' }, ...options],
          defaultValue: '',
          value: selected === undefined ? '' : `value:${selected}`,
          onChange(next) {
            setChoices((previous) => {
              const updated = new Map(previous);

              if (next === '') {
                updated.delete(dimension.id);
              } else {
                updated.set(dimension.id, next.slice('value:'.length));
              }

              return updated;
            });
          },
        };
      }),
    [dimensions, choices, rows],
  );

  const hasSearch = needle !== '' && searchText !== undefined;
  const hasFilters = filters.some((filter) => filter.value !== filter.defaultValue);

  const visibleRows =
    hasSearch || hasFilters
      ? rows.filter((row) => {
          if (hasSearch && !searchText(row).toLowerCase().includes(needle)) {
            return false;
          }

          return dimensions.every(
            (dimension) => !choices.has(dimension.id) || dimension.value(row) === choices.get(dimension.id),
          );
        })
      : rows;

  return { rows: visibleRows, search, filters, isFiltered: hasSearch || hasFilters };
}

export function useFrameTableQuery(): boolean {
  const isFiltered = useContext(QueryFrame);

  if (isFiltered === undefined) {
    throw new Error('A frame-owned table requires its enclosing collection to supply TableQueryFrame.');
  }

  return isFiltered;
}

export function controlledTableControls(query: ControlledTableQuery) {
  if ('reason' in query.search) {
    checkTableQueryException(query.search);
  }

  checkFilters(query.filters);

  const search = 'reason' in query.search ? undefined : query.search;
  const filters = 'reason' in query.filters ? [] : query.filters;

  return {
    search,
    filters,
    isFiltered: Boolean(search?.value.trim()) || filters.some((filter) => filter.value !== filter.defaultValue),
  };
}
