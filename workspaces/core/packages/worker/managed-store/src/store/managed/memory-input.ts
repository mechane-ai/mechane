import { ManagedStoreError, pageSize } from '@mechane/authority-store';
import type { ManagedDocument, ManagedPageQuery, ManagedScope } from '@mechane/authority-store';
import { HttpStatusCode } from '@mechane/records';
import { Record, Schema } from 'effect';

const PATH_MAX_BYTES = 1024;
const PATH_MAX_LEVELS = 20;
const CONTENT_MAX_BYTES = 102_400;
const PAGE_DEFAULT_ROWS = 20;
const NAME_MAX_CHARS = 255;
const DESCRIPTION_MAX_CHARS = 1024;
const METADATA_MAX_ENTRIES = 16;
const METADATA_KEY_MAX_CHARS = 64;
const METADATA_VALUE_MAX_CHARS = 512;
const RESERVED_PATH_CHARACTERS = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;
const CONTROL_CHARACTERS = /\p{Cc}/u;
const forbiddenSegments: ReadonlySet<string> = new Set(['', '.', '..']);
const utf8: Readonly<TextEncoder> = new TextEncoder();
const HASH = /^[a-f0-9]{64}$/u;

export type MemoryStoreKey = { readonly scope: ManagedScope; readonly storeId: string };
export type MemoryKey = MemoryStoreKey & { readonly memoryId: string };
export type VersionKey = MemoryStoreKey & { readonly versionId: string };
export type MemoryView = { readonly view?: 'full' | 'basic' | undefined };

export type MemoryActor =
  | { readonly type: 'api_actor'; readonly api_key_id: string }
  | { readonly type: 'user_actor'; readonly user_id: string }
  | { readonly type: 'session_actor'; readonly session_id: string }
  | { readonly type: 'service_account_actor'; readonly service_account_id: string };

export type MemoryWrite = { readonly actor?: MemoryActor };
export type MemoryBody = { readonly body: ManagedDocument };

export type MemoryQuery = ManagedPageQuery &
  MemoryView & {
    readonly pathPrefix?: string;
    readonly depth?: number;
    readonly operation?: string;
    readonly memoryId?: string;
    readonly sessionId?: string;
    readonly apiKeyId?: string;
    readonly serviceAccountId?: string;
  };

export type ListMemoryInput = MemoryStoreKey & { readonly query: MemoryQuery };
export type MemoryMetadata = Readonly<Record<string, string>>;

export function memoryInvalid(message: string): never {
  throw new ManagedStoreError(HttpStatusCode.BadRequest, message);
}

export function memoryMissing(resource: string): never {
  throw new ManagedStoreError(HttpStatusCode.NotFound, `Unknown ${resource}`);
}

export function memoryContent(value: unknown): Uint8Array {
  if (typeof value !== 'string' || !value.isWellFormed()) {
    return memoryInvalid('Memory content must be UTF-8 text');
  }

  const bytes = utf8.encode(value);

  if (bytes.length > CONTENT_MAX_BYTES) {
    return memoryInvalid('Memory content exceeds 100 KiB');
  }

  return bytes;
}

const utf8Decoder: Readonly<TextDecoder> = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true });

export function memoryText(content: Uint8Array | null): string | null {
  if (content === null) {
    return null;
  }

  return utf8Decoder.decode(content);
}

export function memoryPath(value: unknown): string {
  if (typeof value !== 'string' || !value.startsWith('/') || utf8.encode(value).byteLength > PATH_MAX_BYTES) {
    return memoryInvalid('Expected an absolute memory path of at most 1024 bytes');
  }

  if (!value.isWellFormed() || value.normalize('NFC') !== value || RESERVED_PATH_CHARACTERS.test(value)) {
    return memoryInvalid('Memory path contains invalid characters');
  }

  const segments = value.slice(1).split('/');

  if (segments.length > PATH_MAX_LEVELS || segments.some((segment) => forbiddenSegments.has(segment))) {
    return memoryInvalid('Invalid memory path segment');
  }

  return value;
}

function acceptsStoredText(value: string, maxChars: number): boolean {
  return value.isWellFormed() && !value.includes('\0') && Array.from(value).length <= maxChars;
}

export function memoryName(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return memoryInvalid('Invalid memory store name');
  }

  if (!acceptsStoredText(value, NAME_MAX_CHARS) || CONTROL_CHARACTERS.test(value)) {
    return memoryInvalid('Invalid memory store name');
  }

  return value;
}

export function memoryDescription(value: unknown): string {
  if (typeof value !== 'string' || !acceptsStoredText(value, DESCRIPTION_MAX_CHARS)) {
    return memoryInvalid('Invalid memory store description');
  }

  return value;
}

export function metadataPatch(current: MemoryMetadata, patch: unknown, allowRemovals: boolean): MemoryMetadata {
  if (!Schema.is(Schema.Record(Schema.String, Schema.Unknown))(patch)) {
    return memoryInvalid('Memory store metadata must be an object');
  }

  const values = new Map(Record.toEntries(current));

  for (const [key, value] of Record.toEntries(patch)) {
    if (key.length === 0 || !acceptsStoredText(key, METADATA_KEY_MAX_CHARS)) {
      return memoryInvalid('Invalid memory store metadata key');
    }

    if (value === null && allowRemovals) {
      values.delete(key);
    } else if (typeof value !== 'string' || !acceptsStoredText(value, METADATA_VALUE_MAX_CHARS)) {
      return memoryInvalid('Invalid memory store metadata value');
    } else {
      values.set(key, value);
    }
  }

  if (values.size > METADATA_MAX_ENTRIES) {
    return memoryInvalid('Memory store metadata exceeds 16 pairs');
  }

  return Record.fromEntries(values);
}

export function expectedContentHash(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !HASH.test(value)) {
    return memoryInvalid('Invalid content SHA-256');
  }

  return value;
}

export function writeActor(input: { readonly scope: ManagedScope } & MemoryWrite): MemoryActor {
  if (input.actor !== undefined) {
    return input.actor;
  }

  if (input.scope.apiKeyId !== undefined) {
    return { type: 'api_actor', api_key_id: `apikey_${input.scope.apiKeyId.replaceAll('-', '')}` };
  }

  return { type: 'user_actor', user_id: `user_${input.scope.principalId.replaceAll('-', '')}` };
}

export function memoryPageSize(query: MemoryQuery): number {
  const limit = pageSize(query);

  if (query.view === 'full' && limit > PAGE_DEFAULT_ROWS) {
    return PAGE_DEFAULT_ROWS;
  }

  return limit;
}
