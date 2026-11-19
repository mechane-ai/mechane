import { Schema } from 'effect';
import type { StoreContext } from '../context.ts';
import { StoredText } from '../row-values.ts';
import { managedId } from './managed-record.ts';
import {
  memoryDescription,
  memoryInvalid,
  memoryMissing,
  memoryName,
  memoryPageSize,
  metadataPatch,
} from './memory-input.ts';
import type { MemoryBody, MemoryMetadata, MemoryQuery, MemoryStoreKey } from './memory-input.ts';
import type { ManagedDocument, ManagedPage, ManagedScope } from './types.ts';

const CURSOR_FIELDS = 2;

type StoreRow = {
  readonly type: 'memory_store';
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly metadata: MemoryMetadata;
  readonly archived_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
};

const STORE_COLUMNS = `'memory_store' AS type,id,name,description,metadata,created_at,updated_at,archived_at`;

const SELECT_STORE = `SELECT ${STORE_COLUMNS} FROM mechane.managed_memory_stores
  WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4`;

const INSTRUCTION_MAX_CHARS = 4096;

export async function lockMemoryStore(
  context: StoreContext,
  { scope, storeId }: MemoryStoreKey,
  shouldLockForUpdate: boolean,
): Promise<StoreRow> {
  const parameters = [scope.workspaceId, scope.principalId, scope.isAdmin, storeId];

  if (shouldLockForUpdate) {
    const { rows } = await context.client.query<StoreRow>(`${SELECT_STORE} FOR UPDATE`, parameters);

    return rows[0] ?? memoryMissing('memory store');
  }

  const { rows } = await context.client.query<StoreRow>(`${SELECT_STORE} FOR SHARE`, parameters);

  return rows[0] ?? memoryMissing('memory store');
}

export function requireActive(store: StoreRow): void {
  if (store.archived_at !== null) {
    memoryInvalid('Memory store is archived');
  }
}

export function pageCursor(parts: ReadonlyArray<string>): string {
  return Schema.encodeSync(Schema.StringFromBase64Url)(JSON.stringify(parts));
}

export function readCursor(page: string | undefined, key: string, fieldCount: number): ReadonlyArray<string> {
  if (page === undefined) {
    return [];
  }

  try {
    const decoded = Schema.decodeUnknownSync(Schema.Array(Schema.NonEmptyString))(
      JSON.parse(Schema.decodeUnknownSync(Schema.StringFromBase64Url)(page)),
    );

    const matchesList = decoded.length === fieldCount + 1 && decoded[0] === key;
    const isCanonical = pageCursor(decoded) === page && decoded.every((field) => !field.includes('\0'));

    if (matchesList && isCanonical) {
      return decoded.slice(1);
    }
  } catch {
    return memoryInvalid('Invalid memory page cursor');
  }

  return memoryInvalid('Invalid memory page cursor');
}

function memoryMountPath({ directory }: { readonly directory: string }): string {
  return `/mnt/memory/${directory}`;
}

export async function resolveMemoryMount({
  context,
  scope,
  storeId,
  access,
  instructions,
}: MemoryStoreKey & { readonly context: StoreContext; readonly access?: unknown; readonly instructions?: unknown }) {
  const store = await lockMemoryStore(context, { scope, storeId }, false);

  requireActive(store);

  const mode = access ?? 'read_write';

  switch (mode) {
    case 'read_only':
    case 'read_write':
      break;
    default:
      return memoryInvalid('Invalid memory mount access');
  }

  const guidance = instructions ?? null;

  if (guidance !== null && (typeof guidance !== 'string' || Array.from(guidance).length > INSTRUCTION_MAX_CHARS)) {
    return memoryInvalid('Invalid memory mount instructions');
  }

  const slug = store.name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-|-$/gu, '');

  let directory = slug;

  if (directory.length === 0) {
    directory = store.id;
  }

  return {
    type: 'memory_store',
    memory_store_id: store.id,
    name: store.name,
    description: store.description,
    instructions: guidance,
    access: mode,
    mount_path: memoryMountPath({ directory }),
  };
}

const MountNote = Schema.Struct({
  name: StoredText,
  mount_path: StoredText,
  access: Schema.Literals(['read_only', 'read_write']),
  description: StoredText,
  instructions: Schema.NullOr(StoredText),
});

export function describeMemoryMounts(resources: ReadonlyArray<ManagedDocument>): string {
  const mounts = resources.filter((resource) => resource['type'] === 'memory_store');

  if (mounts.length === 0) {
    return '';
  }

  const descriptions = mounts.map((mount) => Schema.decodeUnknownSync(MountNote)(mount));

  return [
    'These memory stores are mounted in this session. Use your file tools at each mount_path and follow its access mode.',
    JSON.stringify(descriptions),
  ].join('\n');
}

export function memoryStores(context: StoreContext) {
  return {
    async createStore({ scope, body }: { readonly scope: ManagedScope } & MemoryBody) {
      const name = memoryName(body['name']);
      const description = memoryDescription(body['description'] ?? '');
      const metadata = metadataPatch({}, body['metadata'] ?? {}, false);

      const { rows } = await context.client.query<StoreRow>(
        `INSERT INTO mechane.managed_memory_stores(id,workspace_id,creator_id,name,description,metadata)
         VALUES($1,$2,$3,$4,$5,$6) RETURNING ${STORE_COLUMNS}`,
        [managedId('memstore'), scope.workspaceId, scope.principalId, name, description, metadata],
      );

      return rows[0] ?? memoryMissing('memory store');
    },
    async getStore({ scope, storeId }: MemoryStoreKey) {
      const { rows } = await context.client.query<StoreRow>(SELECT_STORE, [
        scope.workspaceId,
        scope.principalId,
        scope.isAdmin,
        storeId,
      ]);

      return rows[0] ?? memoryMissing('memory store');
    },
    async listStores({
      scope,
      query,
    }: {
      readonly scope: ManagedScope;
      readonly query: MemoryQuery;
    }): Promise<ManagedPage> {
      const limit = memoryPageSize(query);
      const [time, id] = readCursor(query.page, 'stores', CURSOR_FIELDS);

      if (time !== undefined && !Number.isFinite(Date.parse(time))) {
        return memoryInvalid('Invalid memory page cursor');
      }

      const { rows } = await context.client.query<StoreRow>(
        `SELECT ${STORE_COLUMNS} FROM mechane.managed_memory_stores
         WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND (archived_at IS NULL OR $4)
          AND ($5::timestamptz IS NULL OR created_at >= $5) AND ($6::timestamptz IS NULL OR created_at <= $6)
          AND ($7::timestamptz IS NULL OR (created_at,id)<($7,$8)) ORDER BY created_at DESC,id DESC LIMIT $9`,
        [
          scope.workspaceId,
          scope.principalId,
          scope.isAdmin,
          query.includeArchived ?? false,
          query.createdAfter,
          query.createdBefore,
          time,
          id,
          limit + 1,
        ],
      );

      const stores = rows.slice(0, limit);
      const last = stores.at(-1);

      if (rows.length > limit && last !== undefined) {
        return { data: stores, next_page: pageCursor(['stores', last.created_at, last.id]) };
      }

      return { data: stores, next_page: null };
    },
    async updateStore(input: MemoryStoreKey & MemoryBody) {
      return await context.atomic(async (transaction) => {
        const current = await lockMemoryStore(transaction, input, true);

        requireActive(current);

        const body = input.body;
        const name = memoryName(body['name'] ?? current.name);
        const description = memoryDescription(body['description'] ?? current.description);
        const metadata = metadataPatch(current.metadata, body['metadata'] ?? {}, true);

        const { rows } = await transaction.client.query<StoreRow>(
          `UPDATE mechane.managed_memory_stores SET name=$2,description=$3,metadata=$4,
             updated_at=CASE WHEN (name,description,metadata) IS DISTINCT FROM ($2,$3,$4::jsonb)
               THEN clock_timestamp() ELSE updated_at END
           WHERE id=$1 RETURNING ${STORE_COLUMNS}`,
          [current.id, name, description, metadata],
        );

        return rows[0] ?? memoryMissing('memory store');
      });
    },
    async archiveStore(input: MemoryStoreKey) {
      return await context.atomic(async (transaction) => {
        const current = await lockMemoryStore(transaction, input, true);

        if (current.archived_at !== null) {
          return current;
        }

        const { rows } = await transaction.client.query<StoreRow>(
          `UPDATE mechane.managed_memory_stores SET archived_at=clock_timestamp(),updated_at=clock_timestamp()
           WHERE id=$1 RETURNING ${STORE_COLUMNS}`,
          [current.id],
        );

        return rows[0] ?? memoryMissing('memory store');
      });
    },
    async deleteStore({ scope, storeId }: MemoryStoreKey) {
      const { rowCount } = await context.client.query(
        'DELETE FROM mechane.managed_memory_stores WHERE workspace_id=$1 AND (creator_id=$2 OR $3) AND id=$4',
        [scope.workspaceId, scope.principalId, scope.isAdmin, storeId],
      );

      if ((rowCount ?? 0) === 0) {
        return memoryMissing('memory store');
      }

      return { type: 'memory_store_deleted', id: storeId };
    },
  };
}
