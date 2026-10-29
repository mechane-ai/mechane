import { openDatabase } from '@mechane/store';
import { MIGRATIONS } from './migrations.ts';
import type { LimiterStore } from './types.ts';
import { limitWindowRecords } from './windows/limit-window-records.ts';

type OpenLimiterStoreInput = { readonly storage: DurableObjectStorage };

/**
 * Opens a limiter's database and applies, in one transaction, every migration its ledger does not record. A stored row
 * that fails to decode is a defect: only this store writes the database.
 */
export function openLimiterStore({ storage }: OpenLimiterStoreInput): LimiterStore {
  return { ...openDatabase({ storage, migrations: MIGRATIONS }), ...limitWindowRecords({ sql: storage.sql }) };
}
