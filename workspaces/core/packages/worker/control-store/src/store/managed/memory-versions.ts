import { HttpStatusCode } from '@mechane/records';
import type { StoreContext } from '../context.ts';
import { ManagedStoreError } from './managed-record.ts';
import { memoryInvalid, memoryMissing, memoryPageSize, memoryText, writeActor } from './memory-input.ts';
import type { ListMemoryInput, MemoryActor, MemoryView, MemoryWrite, VersionKey } from './memory-input.ts';
import { lockMemoryStore, pageCursor, readCursor } from './memory-stores.ts';
import type { ManagedPage } from './types.ts';

const CURSOR_FIELDS = 2;

type Version = {
  readonly type: 'memory_version';
  readonly id: string;
  readonly memory_id: string;
  readonly memory_store_id: string;
  readonly path: string | null;
  readonly operation: 'created' | 'modified' | 'deleted';
  readonly content: Uint8Array | null;
  readonly content_size_bytes: number | null;
  readonly content_sha256: string | null;
  readonly created_by: MemoryActor;
  readonly created_at: string;
  readonly redacted_at: string | null;
  readonly redacted_by: MemoryActor | null;
};

const VERSION_COLUMNS = `'memory_version' AS type,id,memory_id,memory_store_id,path,operation,content_size_bytes,content_sha256,
  created_by,created_at,redacted_at,redacted_by`;

function versionDocument(row: Version) {
  return { ...row, content: memoryText(row.content) };
}

async function getVersion(transaction: StoreContext, input: VersionKey & MemoryView) {
  const { rows } = await transaction.client.query<Version>(
    `SELECT ${VERSION_COLUMNS},CASE WHEN $3 THEN content END AS content FROM mechane.managed_memory_versions
     WHERE memory_store_id=$1 AND id=$2`,
    [input.storeId, input.versionId, input.view !== 'basic'],
  );

  return versionDocument(rows[0] ?? memoryMissing('memory version'));
}

export function memoryVersions(context: StoreContext) {
  return {
    async getVersion(input: VersionKey & MemoryView) {
      return await context.atomic(async (transaction) => {
        await lockMemoryStore(transaction, input, false);

        return await getVersion(transaction, input);
      });
    },
    async listVersions(input: ListMemoryInput): Promise<ManagedPage> {
      const { storeId, query } = input;
      const limit = memoryPageSize(query);
      const [time, id] = readCursor(query.page, storeId, CURSOR_FIELDS);

      if (time !== undefined && !Number.isFinite(Date.parse(time))) {
        return memoryInvalid('Invalid memory version page cursor');
      }

      return await context.atomic(async (transaction) => {
        await lockMemoryStore(transaction, input, false);

        const { rows } = await transaction.client.query<Version>(
          `SELECT ${VERSION_COLUMNS},CASE WHEN $11 THEN content END AS content FROM mechane.managed_memory_versions
           WHERE memory_store_id=$1 AND ($2::text IS NULL OR memory_id=$2)
             AND ($3::text IS NULL OR operation=$3) AND ($4::text IS NULL OR created_by->>'session_id'=$4)
             AND ($5::text IS NULL OR created_by->>'api_key_id'=$5) AND ($6::text IS NULL OR created_by->>'service_account_id'=$6)
             AND ($7::timestamptz IS NULL OR created_at >= $7) AND ($8::timestamptz IS NULL OR created_at <= $8)
             AND ($9::timestamptz IS NULL OR (created_at,id)<($9,$10)) ORDER BY created_at DESC,id DESC LIMIT $12`,
          [
            storeId,
            query.memoryId,
            query.operation,
            query.sessionId,
            query.apiKeyId,
            query.serviceAccountId,
            query.createdAfter,
            query.createdBefore,
            time,
            id,
            query.view === 'full',
            limit + 1,
          ],
        );

        const page = rows.slice(0, limit);
        const versions = page.map(versionDocument);
        const last = page.at(-1);

        if (rows.length > limit && last !== undefined) {
          return { data: versions, next_page: pageCursor([storeId, last.created_at, last.id]) };
        }

        return { data: versions, next_page: null };
      });
    },
    async redactVersion(input: VersionKey & MemoryWrite) {
      return await context.atomic(async (transaction) => {
        await lockMemoryStore(transaction, input, true);

        const current = await getVersion(transaction, { ...input, view: 'basic' });

        if (current.redacted_at !== null) {
          return current;
        }

        const head = await transaction.client.query(
          'SELECT id FROM mechane.managed_memories WHERE memory_store_id=$1 AND id=$2 AND version_id=$3',
          [input.storeId, current.memory_id, input.versionId],
        );

        if ((head.rowCount ?? 0) > 0) {
          throw new ManagedStoreError(HttpStatusCode.Conflict, 'Cannot redact the current version of a live memory');
        }

        const actor = writeActor(input);

        if (actor.type === 'session_actor') {
          throw new ManagedStoreError(HttpStatusCode.NotFound, 'Unknown memory version');
        }

        await transaction.client.query(
          `UPDATE mechane.managed_memory_versions
          SET content=NULL,content_sha256=NULL,content_size_bytes=NULL,path=NULL,redacted_at=clock_timestamp(),redacted_by=$3
          WHERE memory_store_id=$1 AND id=$2`,
          [input.storeId, input.versionId, actor],
        );

        return await getVersion(transaction, input);
      });
    },
  };
}
