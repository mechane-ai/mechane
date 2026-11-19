import { HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import { createHash } from 'node:crypto';
import type { StoreContext } from '../context.ts';
import { managedId, ManagedStoreError } from './managed-record.ts';
import {
  expectedContentHash,
  memoryContent,
  memoryInvalid,
  memoryMissing,
  memoryPageSize,
  memoryPath,
  memoryText,
  writeActor,
} from './memory-input.ts';
import type {
  ListMemoryInput,
  MemoryActor,
  MemoryBody,
  MemoryKey,
  MemoryStoreKey,
  MemoryView,
  MemoryWrite,
} from './memory-input.ts';
import { lockMemoryStore, pageCursor, readCursor, requireActive } from './memory-stores.ts';
import type { ManagedDocument, ManagedPage } from './types.ts';

const listingDepths: ReadonlySet<number> = new Set([0, 1]);
const STORE_MAX_FILES = 10_000;

type Head = {
  readonly id: string;
  readonly memory_store_id: string;
  readonly memory_version_id: string;
  readonly path: string;
  readonly content: Uint8Array | null;
  readonly content_sha256: string;
  readonly content_size_bytes: number;
  readonly created_at: string;
  readonly updated_at: string;
};

type GroupedHead = Head & { readonly display_path: string; readonly is_prefix: boolean };

const HEAD_COLUMNS = `m.id,m.memory_store_id,m.version_id AS memory_version_id,m.path,m.created_at,
  v.created_at AS updated_at,v.content_sha256,v.content_size_bytes`;

const HEAD_JOIN = `mechane.managed_memories m JOIN mechane.managed_memory_versions v
  ON (v.memory_store_id,v.id)=(m.memory_store_id,m.version_id)`;

function visibleHead(head: Head, view: MemoryView['view']): ManagedDocument {
  const content = memoryText(head.content);

  return {
    type: 'memory',
    id: head.id,
    memory_store_id: head.memory_store_id,
    memory_version_id: head.memory_version_id,
    path: head.path,
    content: null,
    ...(view === 'full' && { content }),
    content_sha256: head.content_sha256,
    content_size_bytes: head.content_size_bytes,
    created_at: head.created_at,
    updated_at: head.updated_at,
  };
}

async function getHead(transaction: StoreContext, key: MemoryKey, includeContent: boolean): Promise<Head> {
  const { rows } = await transaction.client.query<Head>(
    `SELECT ${HEAD_COLUMNS},CASE WHEN $3 THEN v.content END AS content
     FROM ${HEAD_JOIN} WHERE m.memory_store_id=$1 AND m.id=$2`,
    [key.storeId, key.memoryId, includeContent],
  );

  return rows[0] ?? memoryMissing('memory');
}

async function checkPath(
  transaction: StoreContext,
  { storeId, id, path }: Pick<VersionWrite, 'storeId' | 'id' | 'path'>,
): Promise<void> {
  const { rows } = await transaction.client.query<{ readonly id: string; readonly path: string }>(
    `SELECT id,path FROM mechane.managed_memories WHERE memory_store_id=$1 AND id<>$2 AND
      (path=$3 OR starts_with(path,$3 || '/') OR starts_with($3,path || '/')) LIMIT 1`,
    [storeId, id, path],
  );

  const conflict = rows[0];

  if (conflict !== undefined) {
    throw new ManagedStoreError(HttpStatusCode.Conflict, 'Memory path conflicts with an existing memory', {
      type: 'memory_path_conflict_error',
      conflicting_path: conflict.path,
      conflicting_memory_id: conflict.id,
    });
  }
}

type VersionWrite = {
  readonly storeId: string;
  readonly id: string;
  readonly actor: MemoryActor;
  readonly path: string;
  readonly operation: 'created' | 'modified' | 'deleted';
  readonly bytes: Uint8Array | null;
};

function contentDigest(bytes: Uint8Array | null): string | null {
  if (bytes === null) {
    return null;
  }

  return createHash('sha256').update(bytes).digest('hex');
}

async function appendVersion(
  transaction: StoreContext,
  { storeId, id, actor, path, operation, bytes }: VersionWrite,
): Promise<string> {
  const versionId = managedId('memver');
  const digest = contentDigest(bytes);

  await transaction.client.query(
    `INSERT INTO mechane.managed_memory_versions
    (memory_store_id,memory_id,id,operation,path,content,content_sha256,content_size_bytes,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [storeId, id, versionId, operation, path, bytes, digest, bytes?.length ?? null, actor],
  );

  return versionId;
}

function checkHash(head: Head, expected: unknown): void {
  const hash = expectedContentHash(expected);

  if (hash !== undefined && hash !== head.content_sha256) {
    throw new ManagedStoreError(HttpStatusCode.Conflict, 'Memory content has changed', {
      type: 'memory_precondition_failed_error',
    });
  }
}

const HashCondition = Schema.Struct({ type: Schema.Literal('content_sha256'), content_sha256: Schema.NonEmptyString });

function precondition(body: ManagedDocument): string | undefined {
  const condition = body['precondition'];

  if (condition === undefined) {
    return undefined;
  }

  if (!Schema.is(HashCondition)(condition)) {
    return memoryInvalid('Invalid memory precondition');
  }

  return condition.content_sha256;
}

function sameContent(stored: Uint8Array | null, candidate: Uint8Array): boolean {
  if (stored === null || stored.byteLength !== candidate.byteLength) {
    return false;
  }

  return candidate.every((byte, index) => byte === stored[index]);
}

export function memoryDocuments(context: StoreContext) {
  return {
    async getMemory(input: MemoryKey & MemoryView) {
      return await context.atomic(async (transaction) => {
        await lockMemoryStore(transaction, input, false);

        const view = input.view ?? 'full';
        const head = await getHead(transaction, input, view === 'full');

        return visibleHead(head, view);
      });
    },
    async createMemory(input: MemoryStoreKey & MemoryBody & MemoryView & MemoryWrite) {
      return await context.atomic(async (transaction) => {
        const store = await lockMemoryStore(transaction, input, true);

        requireActive(store);

        const path = memoryPath(input.body['path']);
        const bytes = memoryContent(input.body['content']);
        const id = managedId('mem');

        await checkPath(transaction, { storeId: store.id, id, path });

        const count = await transaction.client.query<{ readonly total: number }>(
          'SELECT count(*)::integer AS total FROM mechane.managed_memories WHERE memory_store_id=$1',
          [store.id],
        );

        if ((count.rows[0]?.total ?? 0) >= STORE_MAX_FILES) {
          return memoryInvalid('Memory store is full');
        }

        const versionId = await appendVersion(transaction, {
          storeId: store.id,
          id,
          actor: writeActor(input),
          path,
          operation: 'created',
          bytes,
        });

        await transaction.client.query(
          `INSERT INTO mechane.managed_memories(memory_store_id,id,version_id,path,created_at)
          SELECT memory_store_id,memory_id,id,path,created_at FROM mechane.managed_memory_versions WHERE memory_store_id=$1 AND id=$2`,
          [store.id, versionId],
        );

        const head = await getHead(transaction, { ...input, memoryId: id }, input.view === 'full');

        return visibleHead(head, input.view);
      });
    },
    async updateMemory(input: MemoryKey & MemoryBody & MemoryView & MemoryWrite) {
      return await context.atomic(async (transaction) => {
        const store = await lockMemoryStore(transaction, input, true);

        requireActive(store);

        const head = await getHead(transaction, input, true);

        checkHash(head, precondition(input.body));

        const nextPath = input.body['path'] ?? null;
        const nextContent = input.body['content'] ?? null;

        if (nextPath === null && nextContent === null) {
          return memoryInvalid('Set content or path to update a memory');
        }

        const path = memoryPath(nextPath ?? head.path);
        let bytes = head.content;

        if (nextContent !== null) {
          bytes = memoryContent(nextContent);
        }

        if (bytes === null) {
          throw new Error('Stored live memory has no content');
        }

        if (path === head.path && sameContent(head.content, bytes)) {
          return visibleHead(head, input.view);
        }

        if (path !== head.path) {
          await checkPath(transaction, { storeId: store.id, id: head.id, path });
        }

        const next = await appendVersion(transaction, {
          storeId: store.id,
          id: head.id,
          actor: writeActor(input),
          path,
          operation: 'modified',
          bytes,
        });

        await transaction.client.query(
          'UPDATE mechane.managed_memories SET version_id=$3,path=$4 WHERE memory_store_id=$1 AND id=$2',
          [store.id, head.id, next, path],
        );

        return visibleHead(await getHead(transaction, input, input.view === 'full'), input.view);
      });
    },
    async deleteMemory(input: MemoryKey & MemoryWrite & { readonly expectedHash?: string | undefined }) {
      return await context.atomic(async (transaction) => {
        await lockMemoryStore(transaction, input, true);

        const head = await getHead(transaction, input, false);

        checkHash(head, input.expectedHash);
        await appendVersion(transaction, {
          storeId: input.storeId,
          id: head.id,
          actor: writeActor(input),
          operation: 'deleted',
          path: head.path,
          bytes: null,
        });
        await transaction.client.query('DELETE FROM mechane.managed_memories WHERE memory_store_id=$1 AND id=$2', [
          input.storeId,
          head.id,
        ]);

        return { type: 'memory_deleted', id: head.id };
      });
    },
    async listMemories(input: ListMemoryInput): Promise<ManagedPage> {
      const { query, storeId } = input;
      const depth = query.depth ?? 0;

      if (!listingDepths.has(depth)) {
        return memoryInvalid('Memory depth must be 0 or 1');
      }

      const prefix = query.pathPrefix ?? '/';

      if (!prefix.endsWith('/')) {
        return memoryInvalid('Memory path prefix must end with /');
      }

      if (prefix !== '/') {
        memoryPath(prefix.slice(0, -1));
      }

      const limit = memoryPageSize(query);
      const key = JSON.stringify([storeId, prefix, depth]);
      const [after] = readCursor(query.page, key, 1);

      return await context.atomic(async (transaction) => {
        await lockMemoryStore(transaction, input, false);

        const { rows } = await transaction.client.query<GroupedHead>(
          `WITH paths AS (
              SELECT id,path,substring(path FROM char_length($2) + 1) AS suffix FROM mechane.managed_memories
              WHERE memory_store_id=$1 AND starts_with(path,$2)
            ), grouped AS (
              SELECT id,path,CASE WHEN $3=1 AND position('/' IN suffix)>0 THEN $2 || split_part(suffix,'/',1) || '/'
                ELSE path END COLLATE "C" AS display_path FROM paths
            ), page AS (
              SELECT DISTINCT ON(display_path) id,path,display_path FROM grouped
              WHERE $4::text IS NULL OR display_path > $4 COLLATE "C" ORDER BY display_path,id LIMIT $5
            )
            SELECT ${HEAD_COLUMNS},p.display_path,p.path<>p.display_path AS is_prefix,
               CASE WHEN $6 AND p.path=p.display_path THEN v.content END AS content
            FROM page p JOIN ${HEAD_JOIN} ON m.memory_store_id=$1 AND m.id=p.id ORDER BY p.display_path COLLATE "C"`,
          [storeId, prefix, depth, after, limit + 1, query.view === 'full'],
        );

        const page = rows.slice(0, limit);

        const entries = page.map((row) => {
          if (row.is_prefix) {
            return { type: 'memory_prefix', path: row.display_path };
          }

          return visibleHead(row, query.view);
        });

        const last = page.at(-1);

        if (rows.length > limit && last !== undefined) {
          return { data: entries, next_page: pageCursor([key, last.display_path]) };
        }

        return { data: entries, next_page: null };
      });
    },
  };
}
