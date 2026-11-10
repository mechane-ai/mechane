import type { MachineId } from '@mechane/records';
import type { SettledReceipt } from '@mechane/sandbox-wire';
import type { AlarmTimeInput, DatabaseFunctions } from '@mechane/store';
import type { DateTime, Duration, Option } from 'effect';
import type { browserRecords } from './browser/browser-records.ts';
import type { capacityRecords } from './capacity/capacity-records.ts';
import type { completionRecords } from './completions/completion-records.ts';
import type { evidenceRecords } from './evidence/evidence-records.ts';
import type { interactiveRuns } from './interactive-runs.ts';
import type { machineDrains } from './machines/machine-drains.ts';
import type { stopRecords } from './machines/stop-records.ts';
import type { portableMaintenanceRecords } from './maintenance/portable-maintenance-records.ts';
import type { processRecords } from './processes/process-records.ts';
import type { ExecutionRow, LiveMachineRow, MachineIdRow } from './schemas.ts';
import type { workspaceRecords } from './workspaces/workspace-records.ts';

/** A sandbox's executions, each claimed once under its id and settled once by its receipt. */
export type ExecutionRecords = {
  /** The execution its id names, none before its first claim. */
  readonly execution: (input: ExecutionIdInput) => Option.Option<ExecutionRow>;
  /** Absent when no execution currently owns a machine without a settled receipt. */
  readonly activeExecution: () => Option.Option<ExecutionRow>;
  readonly unfinishedExecutions: () => ReadonlyArray<ExecutionRow>;
  readonly cancelPendingExecution: (input: ExecutionIdInput) => void;
  /** Refuses a claimed command before dispatch while preserving its immutable receipt identity. */
  readonly refusePendingExecution: (input: ExecutionIdInput) => void;
  /** Records an execution as pending, the intent of its run, before it is sent anywhere. */
  readonly claimExecution: (input: ClaimExecutionInput) => void;
  /** Records a pending execution as sent to the machine, the intent of the request that runs it. */
  readonly dispatchExecution: (input: DispatchExecutionInput) => void;
  /** Stores a dispatched execution's receipt once. */
  readonly settleExecution: (input: SettleExecutionInput) => void;
  readonly failPersistence: (input: PersistenceFailureInput) => void;
};

/** A sandbox's machines, one opened after another, of which at most one is starting or ready. */
export type MachineRecords = {
  /** The machine that is starting or ready, none when every machine ended. */
  readonly liveMachine: () => Option.Option<LiveMachineRow>;
  /** The machine opened last, in any status; none before the first. */
  readonly latestMachine: () => Option.Option<MachineIdRow>;
  /** The last machine that could admit writers, none when every allocation ended before readiness. */
  readonly latestReadyMachine: () => Option.Option<MachineIdRow>;
  /** Records a machine as starting, the intent of its start. */
  readonly openMachine: (input: MachineTimeInput) => void;
  /** Records that a starting machine's guest answered its health. */
  readonly readyMachine: (input: MachineTimeInput) => void;
  /** Ends a machine that ran; each execution it held without a receipt becomes uncertain. */
  readonly loseMachine: (input: MachineTimeInput) => void;
  /** Ends a machine that never became ready; each execution claimed by its startup deadline becomes unavailable. */
  readonly failMachine: (input: FailMachineInput) => void;
};

/** An execution to claim under its id: its command, and how long it may run, which a repeat of the id must match. */
export type ExecutionClaim = {
  readonly executionId: string;
  readonly command: string;
  readonly timeout: Duration.Duration;
};

export type ClaimExecutionInput = { readonly request: ExecutionClaim; readonly now: DateTime.Utc };

export type DispatchExecutionInput = {
  readonly executionId: string;
  readonly machineId: MachineId;
  readonly now: DateTime.Utc;
};

export type ExecutionIdInput = { readonly executionId: string };

export type FailMachineInput = {
  readonly machineId: MachineId;
  /** The time by which the machine had to answer its health; the executions claimed by then waited for it. */
  readonly startupDeadline: DateTime.Utc;
  readonly now: DateTime.Utc;
};

export type MachineTimeInput = { readonly machineId: MachineId; readonly now: DateTime.Utc };

/** The sandbox object's one alarm wakes for its earliest pending observation, delivery, or idle deadline. */
export type SandboxAlarm = {
  readonly arm: (input: AlarmTimeInput) => Promise<void>;
  readonly scheduledAt: () => Promise<Option.Option<DateTime.Utc>>;
  /** Clears the alarm while it is still set for `at`, so one that a call armed meanwhile stays. */
  readonly disarmAt: (input: AlarmTimeInput) => Promise<void>;
};

/** The sandbox database's operations and migration revision. */
export type SandboxStore = DatabaseFunctions &
  ReturnType<typeof browserRecords> &
  ReturnType<typeof capacityRecords> &
  ReturnType<typeof completionRecords> &
  ReturnType<typeof evidenceRecords> &
  ReturnType<typeof interactiveRuns> &
  ReturnType<typeof machineDrains> &
  ReturnType<typeof stopRecords> &
  ReturnType<typeof processRecords> &
  MachineRecords &
  ExecutionRecords &
  ReturnType<typeof portableMaintenanceRecords> &
  ReturnType<typeof workspaceRecords>;

export type SettleExecutionInput = {
  readonly executionId: string;
  /** The machine the execution was sent to, whose guest answered the receipt. */
  readonly machineId: MachineId;
  readonly receipt: SettledReceipt;
  readonly now: DateTime.Utc;
};

export type PersistenceFailureInput = SettleExecutionInput & { readonly reason: string };

export type SandboxStoreInput = { readonly storage: DurableObjectStorage };
