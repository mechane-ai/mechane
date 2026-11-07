import { openDatabase } from '@mechane/store';
import { capacityRecords } from './capacity/capacity-records.ts';
import { executionRecords } from './executions/execution-records.ts';
import { machineRecords } from './machines/machine-records.ts';
import { portableMaintenanceRecords } from './maintenance/portable-maintenance-records.ts';
import { MIGRATIONS } from './migrations.ts';
import type { SandboxStore, SandboxStoreInput } from './types.ts';
import { workspaceRecords } from './workspaces/workspace-records.ts';

/**
 * Opens a sandbox's database and applies, in one transaction, every migration its ledger does not record. A stored row
 * that fails to decode is a defect: only this store writes the database.
 */
export function openSandboxStore({ storage }: SandboxStoreInput): SandboxStore {
  const { sql } = storage;

  return {
    ...openDatabase({ storage, migrations: MIGRATIONS }),
    ...capacityRecords({ sql }),
    ...machineRecords({ sql }),
    ...portableMaintenanceRecords({ sql }),
    ...executionRecords({ sql }),
    ...workspaceRecords({ sql }),
  };
}
