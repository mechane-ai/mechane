import type { AlarmTimeInput, DatabaseFunctions } from '@mechane/store';
import type { DateTime, Option } from 'effect';
import type { browserRecords } from './browser/browser-records.ts';
import type { capacityRecords } from './capacity/capacity-records.ts';
import type { completionRecords } from './completions/completion-records.ts';
import type { installedProcessCompletions } from './completions/installed-process-completions.ts';
import type { evidenceRecords } from './evidence/evidence-records.ts';
import type { executionRecords } from './executions/execution-records.ts';
import type { interactiveRuns } from './interactive-runs.ts';
import type { machineDrains } from './machines/machine-drains.ts';
import type { machineRecords } from './machines/machine-records.ts';
import type { startupRecords } from './machines/startup-records.ts';
import type { stopRecords } from './machines/stop-records.ts';
import type { portableMaintenanceRecords } from './maintenance/portable-maintenance-records.ts';
import type { processRecords } from './processes/process-records.ts';
import type { workspaceRecords } from './workspaces/workspace-records.ts';

/** The sandbox object's one alarm wakes for its earliest pending observation, delivery, or idle deadline. */
export type SandboxAlarm = {
  readonly arm: (input: AlarmTimeInput) => Promise<void>;
  readonly scheduledAt: () => Promise<Option.Option<DateTime.Utc>>;
  /** Clears the alarm while it is still set for `at`, so one that a call armed meanwhile stays. */
  readonly disarmAt: (input: AlarmTimeInput) => Promise<void>;
};

/** The sandbox database's operations and migration revision. */
export type SandboxStore = DatabaseFunctions & { readonly purgeInstalledSession: () => void } & ReturnType<
    typeof browserRecords
  > &
  ReturnType<typeof capacityRecords> &
  ReturnType<typeof completionRecords> &
  ReturnType<typeof installedProcessCompletions> &
  ReturnType<typeof evidenceRecords> &
  ReturnType<typeof interactiveRuns> &
  ReturnType<typeof machineDrains> &
  ReturnType<typeof stopRecords> &
  ReturnType<typeof processRecords> &
  ReturnType<typeof startupRecords> &
  ReturnType<typeof machineRecords> &
  ReturnType<typeof executionRecords> &
  ReturnType<typeof portableMaintenanceRecords> &
  ReturnType<typeof workspaceRecords>;

export type SandboxStoreInput = { readonly storage: DurableObjectStorage };
