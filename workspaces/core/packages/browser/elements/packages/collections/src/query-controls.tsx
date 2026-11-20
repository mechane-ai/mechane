import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType } from 'react';
import type { CollectionFilter } from './collection-filters.tsx';

export type CollectionSearch = {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onSubmit?: () => void;
  readonly label?: string;
  readonly placeholder?: string;
};

type QueryOptions = {
  readonly search: CollectionSearch | undefined;
  readonly groups: ReadonlyArray<CollectionFilter>;
  readonly selections: Readonly<Record<string, string>>;
  readonly isDisabled: boolean;
};

function queryState(options: QueryOptions) {
  return {
    value: options.search?.value ?? '',
    filters: options.selections,
    disabled: options.isDisabled,
    available: options.search !== undefined || options.groups.length > 0,
  };
}

function readFilterOption(encoded: string): readonly [string, string] {
  const pair: unknown = JSON.parse(encoded);

  if (Array.isArray(pair) && pair.length === 2) {
    const filter: unknown = pair[0];
    const value: unknown = pair[1];

    if (typeof filter === 'string' && typeof value === 'string') {
      return [filter, value];
    }
  }

  throw new Error('Select a listed filter option, or provide a filter ID and value.');
}

const collectionQuery = definePrimitive({
  name: 'collection-query',
  options: { search: 'value', groups: 'list', selections: 'value', isDisabled: 'boolean' },
  state: queryState,
  sync: queryState,
  controlled: ['value', 'filters'],
  api: ({ options }) => ({
    get setQuery() {
      const { search, isDisabled } = options();

      if (isDisabled || search === undefined) {
        return null;
      }

      return (value: unknown) => {
        if (typeof value !== 'string') {
          throw new TypeError('The search term must be a string.');
        }

        search.onChange(value);
      };
    },
    get submitSearch() {
      const { search, isDisabled } = options();

      return isDisabled ? undefined : search?.onSubmit;
    },
    get setFilter() {
      const { groups, isDisabled } = options();

      if (isDisabled || groups.length === 0) {
        return null;
      }

      return (id: string, value?: string) => {
        const [filterId, choice] = value === undefined ? readFilterOption(id) : [id, value];
        const group = groups.find((candidate) => candidate.id === filterId);

        if (group === undefined || !group.options.some((option) => option.value === choice)) {
          throw new Error('Unknown filter or option. Choose one of the listed filter options.');
        }

        group.onChange(choice);
      };
    },
    items() {
      return options().groups.flatMap((group) =>
        group.options.map((option) => ({
          value: JSON.stringify([group.id, option.value]),
          label: `${group.label} · ${option.label}`,
        })),
      );
    },
  }),
  agent: {
    actions: ['setQuery', 'submitSearch', 'setFilter'],
    items: (api) => api.items(),
    shown: (state) => state.available && !state.disabled,
  },
  slots: (slot) => ({ root: slot({ attrs: () => ({ role: 'group' }) }) }),
});

const parts = createParts(collectionQuery, { root: 'div' });
export const QueryControls: ComponentType<Omit<PartProps<'div'>, 'id'> & QueryOptions> = parts.Root;
