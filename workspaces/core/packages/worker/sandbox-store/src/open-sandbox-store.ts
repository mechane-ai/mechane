import { openDatabase } from '@mechane/store';
import { browserRecords } from './browser/browser-records.ts';
import { capacityRecords } from './capacity/capacity-records.ts';
import { completionRecords } from './completions/completion-records.ts';
import { evidenceRecords } from './evidence/evidence-records.ts';
import { executionRecords } from './executions/execution-records.ts';
import { interactiveRuns } from './interactive-runs.ts';
import { machineDrains } from './machines/machine-drains.ts';
import { machineRecords } from './machines/machine-records.ts';
import { portableMaintenanceRecords } from './maintenance/portable-maintenance-records.ts';
import { MIGRATIONS } from './migrations.ts';
import { processRecords } from './processes/process-records.ts';
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
    ...browserRecords({ sql }),
    ...capacityRecords({ sql }),
    ...completionRecords({ sql }),
    ...evidenceRecords({ sql }),
    ...interactiveRuns({ sql }),
    ...machineDrains({ sql }),
    ...machineRecords({ sql }),
    ...portableMaintenanceRecords({ sql }),
    ...executionRecords({ sql }),
    ...processRecords({ sql }),
    ...workspaceRecords({ sql }),
  };
}
