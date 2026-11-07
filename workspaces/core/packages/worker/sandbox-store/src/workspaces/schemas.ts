import { MachineId, RecordId, RecordText, SandboxOperationId } from '@mechane/records';
import { ExecutionId, ExecutionProgress, SandboxArchive, SettledReceipt } from '@mechane/sandbox-wire';
import { Schema } from 'effect';
import { MachineIdRow } from '../schemas.ts';

/** The committed portable archive and its previous generation. */
export const WorkspaceSnapshot = Schema.Struct({
  generation: RecordId,
  /** Absent for the first committed generation. */
  parent: Schema.OptionFromNullOr(RecordId),
  archive: Schema.toType(SandboxArchive),
});

export type WorkspaceSnapshot = typeof WorkspaceSnapshot.Type;

/** Transfer state shared by command receipts and explicit file operations. */
const CheckpointTransfer = Schema.Struct({
  generation: RecordId,
  /** Absent for the first committed generation. */
  parent: Schema.OptionFromNullOr(RecordId),
  machineId: MachineIdRow.fields.id,
  startedAt: Schema.DateTimeUtcFromMillis,
  /** Absent until the guest finishes and validates its archive. */
  archive: Schema.OptionFromNullOr(Schema.toType(SandboxArchive)),
  part: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

/** A command receipt commits atomically with its filesystem generation. */
export const CommandCheckpoint = Schema.Struct({
  ...CheckpointTransfer.fields,
  executionId: ExecutionId,
  receipt: SettledReceipt,
});

export type CommandCheckpoint = typeof CommandCheckpoint.Type;

/** Why a file checkpoint exists; none of these operations executes a shell command. */
export const FileCheckpointPurpose = Schema.TaggedUnion({
  Maintenance: { operationId: SandboxOperationId },
  Drain: { operationId: SandboxOperationId, machineId: MachineId },
});

export type FileCheckpointPurpose = typeof FileCheckpointPurpose.Type;

/** An explicit file operation uses the same transfer machinery as a settled command. */
export const FileCheckpoint = Schema.Struct({ ...CheckpointTransfer.fields, purpose: FileCheckpointPurpose });

export type FileCheckpoint = typeof FileCheckpoint.Type;

/** Both origins advance one file generation through the same archive, upload, and recovery steps. */
export const WorkspaceCheckpoint = Schema.Union([CommandCheckpoint, FileCheckpoint]);

export type WorkspaceCheckpoint = typeof WorkspaceCheckpoint.Type;

/** Operation receipts survive retries independently of later changes to the committed head. */
export const FileCheckpointResult = Schema.TaggedUnion({
  Pending: {},
  Committed: { generation: RecordId },
  Failed: { reason: RecordText },
});

export type FileCheckpointResult = typeof FileCheckpointResult.Type;

/** The durable part cursor for restoring a committed generation to one machine. */
export const WorkspaceRestoration = Schema.Struct({
  machineId: MachineIdRow.fields.id,
  generation: RecordId,
  startedAt: Schema.DateTimeUtcFromMillis,
  part: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type WorkspaceRestoration = typeof WorkspaceRestoration.Type;

/** The live machine and failed generation retained for a later cleanup or export command. */
export const WorkspaceRecovery = Schema.Struct({
  generation: RecordId,
  machineId: MachineIdRow.fields.id,
  reason: ExecutionProgress.cases.PersistenceFailed.fields.reason,
});

export type WorkspaceRecovery = typeof WorkspaceRecovery.Type;
