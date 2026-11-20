import { HttpStatusCode } from '@mechane/records';
import { Predicate, Schema } from 'effect';
import { randomUUID } from 'node:crypto';
import type { ManagedConflictDetails, ManagedDocument, ManagedPageQuery } from './managed-types.ts';
import { StoredText, StoredTimestamp } from './row-values.ts';

type ManagedErrorCode = (typeof HttpStatusCode)[
  | 'BadRequest'
  | 'Forbidden'
  | 'NotFound'
  | 'PreconditionFailed'
  | 'Conflict'
  | 'TooManyRequests'];

export class ManagedStoreError extends Error {
  readonly status: ManagedErrorCode;
  readonly wireError?: ManagedConflictDetails;
  constructor(status: ManagedErrorCode, message: string, wireError?: ManagedConflictDetails) {
    super(message);

    this.status = status;

    if (wireError !== undefined) {
      this.wireError = wireError;
    }

    this.name = 'ManagedStoreError';
  }
}

const PAGE_DEFAULT_ROWS = 20;
const PAGE_MAX_ROWS = 100;
const PageKey = Schema.Struct({ createdAt: StoredTimestamp, id: StoredText });
type PageKey = typeof PageKey.Type;

export function pageSize(query: ManagedPageQuery = {}, maximum = PAGE_MAX_ROWS): number {
  const limit = query.maxRows ?? PAGE_DEFAULT_ROWS;

  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, `Page size must be between 1 and ${maximum}`);
  }

  return limit;
}

export function encodePage(key: PageKey): string {
  const json = JSON.stringify({ createdAt: key.createdAt, id: key.id });

  return Schema.encodeSync(Schema.StringFromBase64Url)(json);
}

export function decodePage(page?: string): PageKey | null {
  if (page === undefined) {
    return null;
  }

  try {
    const rawCursor: unknown = JSON.parse(Schema.decodeUnknownSync(Schema.StringFromBase64Url)(page));
    const key = Schema.decodeUnknownSync(PageKey)(rawCursor);

    if (!Number.isFinite(Date.parse(key.createdAt)) || key.id.length === 0 || encodePage(key) !== page) {
      throw new Error('Invalid page key');
    }

    return key;
  } catch {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, 'Invalid pagination cursor');
  }
}

export function managedId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll('-', '')}`;
}

export const isManagedDocument = Predicate.isObject;

export function managedDocument(value: unknown, field: string): ManagedDocument {
  if (!isManagedDocument(value)) {
    throw new ManagedStoreError(HttpStatusCode.BadRequest, `${field} must be an object`);
  }

  return value;
}
