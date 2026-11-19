import type { ManagedPageQuery } from '@mechane/control-store';
import type { Types } from 'effect';
import type { ManagedRequest } from './types.ts';

export function managedPageQuery(query: ManagedRequest['query']): ManagedPageQuery {
  const page: Types.Mutable<ManagedPageQuery> = {};

  if (typeof query['page'] === 'string') {
    page.page = query['page'];
  }

  if (typeof query['limit'] === 'number') {
    page.maxRows = query['limit'];
  }

  if (typeof query['include_archived'] === 'boolean') {
    page.includeArchived = query['include_archived'];
  }

  if (typeof query['created_at[gte]'] === 'string') {
    page.createdAfter = query['created_at[gte]'];
  }

  if (typeof query['created_at[lte]'] === 'string') {
    page.createdBefore = query['created_at[lte]'];
  }

  if (typeof query['created_at[gt]'] === 'string') {
    page.createdAfterExclusive = query['created_at[gt]'];
  }

  if (typeof query['created_at[lt]'] === 'string') {
    page.createdBeforeExclusive = query['created_at[lt]'];
  }

  return page;
}
