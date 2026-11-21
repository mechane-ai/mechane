import type { MachineId } from '@mechane/records';
import type { ExecutionId, SettledReceipt } from '@mechane/sandbox-wire';
import type { DateTime, Duration } from 'effect';

/** An execution to claim under its id: its command, and how long it may run, which a repeat of the id must match. */
export type ExecutionClaim = {
  readonly executionId: ExecutionId;
  readonly command: string;
  readonly timeout: Duration.Duration;
};

export type ClaimExecutionInput = { readonly request: ExecutionClaim; readonly now: DateTime.Utc };

export type DispatchExecutionInput = {
  readonly executionId: ExecutionId;
  readonly machineId: MachineId;
  readonly now: DateTime.Utc;
};

export type ExecutionIdInput = { readonly executionId: ExecutionId };

export type SettleExecutionInput = {
  readonly executionId: ExecutionId;
  /** The machine the execution was sent to, whose guest answered the receipt. */
  readonly machineId: MachineId;
  readonly receipt: SettledReceipt;
  readonly now: DateTime.Utc;
};

export type PersistenceFailureInput = SettleExecutionInput & { readonly reason: string };
