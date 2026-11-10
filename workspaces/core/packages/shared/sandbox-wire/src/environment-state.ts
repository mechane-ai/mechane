import { MachineId, RecordId, RecordText, SandboxOperationId, wireStruct } from '@mechane/records';
import { Schema } from 'effect';
import { ExecutionId } from './schemas.ts';

/** Distinguishes accepted stop intent from file saving and confirmed provider shutdown. */
export const SandboxStopPhase = {
  Requested: 'requested',
  WaitingForCommands: 'waiting_for_commands',
  Checkpointing: 'checkpointing',
  Stopping: 'stopping',
  Completed: 'completed',
  Failed: 'failed',
} as const;

/** Names the next safe action without turning inspection into a retry or repair. */
export const SandboxRecoveryAction = {
  None: 'none',
  Wait: 'wait',
  RepairWorkspace: 'repair_workspace',
  RetryStop: 'retry_stop',
} as const;

/** Bounds provider failure text retained in an operation receipt. */
export const SANDBOX_FAILURE_MAX_CHARS = 2000;

/** A stop acknowledgement names its durable operation; only completed confirms provider shutdown. */
export const SandboxStopReceipt = wireStruct({
  fields: {
    operationId: SandboxOperationId,
    machineId: Schema.OptionFromNullOr(MachineId),
    phase: Schema.Enum(SandboxStopPhase),
    /** Older drain intents did not retain their request time. */
    requestedAt: Schema.OptionFromNullOr(Schema.DateTimeUtcFromString),
    updatedAt: Schema.DateTimeUtcFromString,
    /** The last committed home observed by this operation, separate from the pending archive. */
    generation: Schema.OptionFromNullOr(RecordId),
    lastError: Schema.OptionFromNullOr(RecordText),
    recoveryAction: Schema.Enum(SandboxRecoveryAction),
  },
});

export type SandboxStopReceipt = typeof SandboxStopReceipt.Type;

/** Absence means no stop was admitted under the inspected identity. */
export const SandboxStopObservation = Schema.OptionFromNullOr(SandboxStopReceipt);

const CheckpointStatus = wireStruct({
  fields: {
    generation: RecordId,
    machineId: MachineId,
    executionId: Schema.OptionFromNullOr(ExecutionId),
    operationId: Schema.OptionFromNullOr(SandboxOperationId),
    startedAt: Schema.DateTimeUtcFromString,
    uploadedParts: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
    totalParts: Schema.OptionFromNullOr(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  },
});

const RecoveryStatus = wireStruct({ fields: { generation: RecordId, machineId: MachineId, reason: RecordText } });

/** Inspection distinguishes committed files, an unfinished transfer, and retained recovery files. */
export const SandboxEnvironmentState = wireStruct({
  fields: {
    committedGeneration: Schema.OptionFromNullOr(RecordId),
    checkpoint: Schema.OptionFromNullOr(CheckpointStatus),
    recovery: Schema.OptionFromNullOr(RecoveryStatus),
    stop: Schema.OptionFromNullOr(SandboxStopReceipt),
  },
});

export type SandboxEnvironmentState = typeof SandboxEnvironmentState.Type;
