import { openDatabase } from '@mechane/store';
import { connectionRecords } from './connections/connection-records.ts';
import { dispatchRecords } from './dispatches/dispatch-records.ts';
import { machineLeaseRecords } from './leases/machine-lease-records.ts';
import { mechIndexRecords } from './mechs/mech-index-records.ts';
import { MIGRATIONS } from './migrations.ts';
import { slackRecords } from './slack/slack-records.ts';
import type { WorkspaceStore } from './types.ts';

type OpenWorkspaceStoreInput = { readonly storage: DurableObjectStorage };

/**
 * Opens a workspace's database and applies, in one transaction, every migration its ledger does not record. A stored
 * row that fails to decode is a defect: only this store writes the database.
 */
export function openWorkspaceStore({ storage }: OpenWorkspaceStoreInput): WorkspaceStore {
  const { sql } = storage;

  return {
    ...openDatabase({ storage, migrations: MIGRATIONS }),
    ...mechIndexRecords({ sql }),
    ...dispatchRecords({ sql }),
    ...machineLeaseRecords({ sql }),
    ...slackRecords({ sql }),
    ...connectionRecords({ sql }),
  };
}
