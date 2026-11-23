import { definePrimitive, dispatch } from '@ui-sdk/core';
import type { ChangeDetails } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType } from 'react';
import type { CollectionFilter } from './collection-filters.tsx';

/** Why a search term changed: typing, the close button, Escape, a form reset, or a call such as an agent's step. */
export type CollectionSearchDetails = ChangeDetails<
  'input-change' | 'clear-press' | 'escape-key' | 'reset' | 'imperative'
>;

export type CollectionSubmitDetails = ChangeDetails<'enter-key' | 'imperative'>;

export type CollectionSearch = {
  readonly value: string;
  readonly onChange: (value: string, details: CollectionSearchDetails) => void;
  readonly onSubmit?: (value: string, details: CollectionSubmitDetails) => void;
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

        dispatch({ options: () => search }, 'onChange', value, { reason: 'imperative' });
      };
    },
    get submitSearch() {
      const { search, isDisabled } = options();

      if (isDisabled || search?.onSubmit === undefined) {
        return null;
      }

      return () => {
        dispatch({ options: () => search }, 'onSubmit', search.value, { reason: 'imperative' });
      };
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

        dispatch({ options: () => group }, 'onChange', choice, { reason: 'imperative' });
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
  // The role comes from the toolbar that renders the root: a toolbar alone, or a group inside another.
  slots: (slot) => ({ root: slot({}) }),
});

const parts = createParts(collectionQuery, { root: 'div' });
export const QueryControls: ComponentType<Omit<PartProps<'div'>, 'id'> & QueryOptions> = parts.Root;
