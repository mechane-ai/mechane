import { TableQueryFrame, useCollectionControls } from '@mechane-ai/elements/collections';
import { PageLayout } from '@mechane-ai/elements/layout';
import { listFilters, listQuery } from '@mechane/console-data';
import type { ListKind, ListQuery } from '@mechane/console-data';
import { useNavigate } from '@tanstack/react-router';
import type { ComponentProps, ReactNode } from 'react';
import type { ConsoleLocation } from './types.ts';

const listLabels = { agents: 'agents', sessions: 'sessions', sessionEvidence: 'captures' } satisfies Record<
  ListKind,
  string
>;

type ListPageProps<Item extends string> = ComponentProps<typeof PageLayout<Item>> & {
  readonly kind: ListKind;
  readonly location: ConsoleLocation;
  readonly showQuery?: boolean;
};

export function ListPage<Item extends string>({
  kind,
  location,
  showQuery = true,
  actions,
  navigation,
  children,
  ...layout
}: ListPageProps<Item>): ReactNode {
  const navigate = useNavigate();
  const { filter } = listQuery(kind, location);
  const defaultValue = kind === 'agents' ? 'active' : '';

  function update(change: ListQuery): void {
    void navigate({
      to: '.',
      replace: true,
      resetScroll: false,
      search: (previous) => {
        const next = { ...previous, ...change };
        delete next.page;

        if (next.search === '') {
          delete next.search;
        }

        if (next.filter === '' || next.filter === defaultValue) {
          delete next.filter;
        }

        return next;
      },
      state: (previous) => ({ ...previous, managedPages: [] }),
    });
  }

  const controls = useCollectionControls({
    label: `Search and filter ${listLabels[kind]}`,
    isReady: true,
    search: {
      label: `Search ${listLabels[kind]}`,
      value: location.search ?? '',
      onChange: (search) => update({ search }),
    },
    filters: [
      {
        id: 'status',
        label: 'Status',
        value: filter ?? defaultValue,
        defaultValue,
        options: [
          ...(defaultValue === '' ? [{ value: '', label: 'All' }] : []),
          ...listFilters[kind].map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) })),
        ],
        onChange: (value) => update({ filter: value }),
      },
    ],
  });

  if (!showQuery) {
    return (
      <PageLayout {...layout} actions={actions} navigation={navigation}>
        {children}
      </PageLayout>
    );
  }

  const isFiltered = Boolean(location.search?.trim()) || (filter ?? defaultValue) !== defaultValue;

  return (
    <TableQueryFrame search filters isFiltered={isFiltered}>
      <PageLayout
        {...layout}
        actions={
          navigation === undefined ? (
            <>
              {controls.actions}
              {actions}
            </>
          ) : (
            actions
          )
        }
        navigation={
          navigation === undefined
            ? undefined
            : {
                ...navigation,
                actions: (
                  <>
                    {navigation.actions}
                    {controls.actions}
                  </>
                ),
              }
        }
      >
        {controls.chips}
        {children}
      </PageLayout>
    </TableQueryFrame>
  );
}
