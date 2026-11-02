import { SandboxArchive } from '@mechane/protocol';
import { RecordId, RecordText, SandboxOperationId, SourceId } from '@mechane/records';
import { ExecutionId, ExecutionProgress, SettledReceipt } from '@mechane/sandbox-wire';
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

/** The shipped command-checkpoint shape remains readable and writable without rewriting stored instances. */
export const CommandCheckpoint = Schema.Struct({
  ...CheckpointTransfer.fields,
  executionId: ExecutionId,
  receipt: SettledReceipt,
});

export type CommandCheckpoint = typeof CommandCheckpoint.Type;

/** Each source stage commits its own generation before the owning source operation can advance. */
export const SourceCheckpointKind = { Preparation: 'prepare', Finalization: 'finalize' } as const;

export type SourceCheckpointKind = (typeof SourceCheckpointKind)[keyof typeof SourceCheckpointKind];

/** Why a file checkpoint exists; none of these operations executes a shell command. */
export const FileCheckpointPurpose = Schema.TaggedUnion({
  Source: { sourceId: SourceId, stage: Schema.Enum(SourceCheckpointKind) },
  Maintenance: { operationId: SandboxOperationId },
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
