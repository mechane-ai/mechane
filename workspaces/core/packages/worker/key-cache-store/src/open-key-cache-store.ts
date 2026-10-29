import { openDatabase } from '@mechane/store';
import { cachedKeyRecords } from './keys/cached-key-records.ts';
import { MIGRATIONS } from './migrations.ts';
import type { KeyCacheStore } from './types.ts';

type OpenKeyCacheStoreInput = { readonly storage: DurableObjectStorage };

/**
 * Opens a key cache shard's database and applies, in one transaction, every migration its ledger does not record. A
 * stored row that fails to decode is a defect: only this store writes the database.
 */
export function openKeyCacheStore({ storage }: OpenKeyCacheStoreInput): KeyCacheStore {
  return { ...openDatabase({ storage, migrations: MIGRATIONS }), ...cachedKeyRecords({ sql: storage.sql }) };
}
