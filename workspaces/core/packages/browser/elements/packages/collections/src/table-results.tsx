import { definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import type { PartProps } from '@ui-sdk/react/primitive';
import type { ComponentType } from 'react';
import type { CollectionPaginationProps } from './collection-controls.tsx';

export type DataTableSort = { readonly columnId: string; readonly direction: 'ascending' | 'descending' };

export type TableResultStatus = 'ready' | 'pending' | 'failed';

type ResultOptions = {
  readonly status: TableResultStatus;
  readonly sort: DataTableSort | undefined;
  readonly pagination: CollectionPaginationProps | undefined;
  readonly captionElement: { readonly current: HTMLTableCaptionElement | null };
  readonly isPlaceholder: boolean;
};

function resultState({ status, sort, pagination, isPlaceholder }: ResultOptions) {
  return {
    status,
    pending: status === 'pending',
    sort: sort ?? null,
    page: pagination?.description ?? null,
    hasPreviousPage: pagination !== undefined && !pagination.previous.disabled,
    hasNextPage: pagination !== undefined && !pagination.next.disabled,
    isPlaceholder,
  };
}

const privateContent = '[hidden], [inert], [aria-hidden="true"], [data-agent-hidden], [data-agent-secret]';

function mountedRecords(caption: HTMLTableCaptionElement | null) {
  const body = caption?.closest('table')?.tBodies[0];

  if (body === undefined || body.closest(privateContent) !== null) {
    return [];
  }

  return Array.from(body.rows).flatMap((row) => {
    const value = row.dataset['rowId'];
    const cell = Array.from(row.cells).find((element) => element.dataset['recordLabel'] !== undefined);

    if (value === undefined || cell === undefined || cell.closest(privateContent) !== null) {
      return [];
    }

    if (
      !cell.checkVisibility({ visibilityProperty: true }) ||
      cell.querySelector('[data-agent-secret], [data-agent-hidden]') !== null
    ) {
      return [];
    }

    const source = cell.querySelector('[data-row-action][aria-label]') ?? cell.querySelector('[data-record-text]');

    if (
      source !== null &&
      (source.closest(privateContent) !== null || !source.checkVisibility({ visibilityProperty: true }))
    ) {
      return [];
    }

    const label = source?.getAttribute('aria-label') ?? source?.textContent.trim();

    return [{ value, label: label === undefined || label.length === 0 ? value : label }];
  });
}

const collectionResults = definePrimitive({
  name: 'collection-results',
  options: { status: 'string', sort: 'value', pagination: 'value', captionElement: 'value', isPlaceholder: 'boolean' },
  state: resultState,
  sync: resultState,
  controlled: ['status', 'sort', 'page', 'hasPreviousPage', 'hasNextPage'],
  api: ({ options }) => ({ records: () => mountedRecords(options().captionElement.current) }),
  agent: { actions: [], items: (api) => api.records(), shown: (state) => !state.isPlaceholder },
  slots: (slot) => ({ root: slot({}) }),
});

export const TableResultCaption: ComponentType<Omit<PartProps<'caption'>, 'id'> & ResultOptions> = createParts(
  collectionResults,
  { root: 'caption' },
).Root;

type RecordOptions = { readonly recordId: string; readonly collection: string };

function recordState({ recordId, collection }: RecordOptions) {
  return { recordId, collection };
}

const collectionRecord = definePrimitive({
  name: 'collection-record',
  options: { recordId: 'string', collection: 'string' },
  state: recordState,
  sync: recordState,
  controlled: ['recordId', 'collection'],
  api: () => ({}),
  slots: (slot) => ({ root: slot({}) }),
});

type RecordTrigger<Tag extends 'a' | 'button'> = ComponentType<Omit<PartProps<Tag>, 'id'> & RecordOptions>;

export const RecordLink: RecordTrigger<'a'> = createParts(collectionRecord, { root: 'a' }).Root;
export const RecordButton: RecordTrigger<'button'> = createParts(collectionRecord, { root: 'button' }).Root;
