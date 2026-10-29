import { openDatabase } from '@mechane/store';
import { browserSessionRecords } from './browser-sessions/browser-session-records.ts';
import { deviceApprovalRecords } from './device-approvals/device-approval-records.ts';
import { keyRecords } from './keys/key-records.ts';
import { MIGRATIONS } from './migrations.ts';
import { principalRecords } from './principals/principal-records.ts';
import { signInRecords } from './sign-ins/sign-in-records.ts';
import type { DirectoryStore } from './types.ts';
import { workspaceRecords } from './workspaces/workspace-records.ts';

type OpenDirectoryStoreInput = { readonly storage: DurableObjectStorage };

/**
 * Opens the directory database and applies, in one transaction, every migration its ledger does not record. A stored
 * row that fails to decode is a defect: only this store writes the database.
 */
export function openDirectoryStore({ storage }: OpenDirectoryStoreInput): DirectoryStore {
  const { sql } = storage;

  return {
    ...openDatabase({ storage, migrations: MIGRATIONS }),
    ...deviceApprovalRecords({ sql }),
    ...keyRecords({ sql }),
    ...principalRecords({ sql }),
    ...workspaceRecords({ sql }),
    ...browserSessionRecords({ sql }),
    ...signInRecords({ sql }),
  };
}
