import { MachineId, RecordId, SandboxOperationId, Sequence, SHA256_PATTERN } from '@mechane/records';
import {
  ExecutionProgress,
  SandboxArchive,
  SandboxCheckpointResult,
  SandboxRecoveryCheckpointRequest,
} from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import { MachineIdRow } from '../schemas.ts';

/** The immutable generation document published after every archive part exists. */
export const WorkspaceManifest = Schema.Struct({
  generation: RecordId,
  /** Absent for the first committed generation. */
  parent: Schema.OptionFromNullOr(RecordId),
  archive: Schema.toType(SandboxArchive),
});

export type WorkspaceManifest = typeof WorkspaceManifest.Type;

/** Published generations reference their manifest; older committed generations retain their inline metadata. */
export const WorkspaceSnapshot = Schema.Struct({
  ...WorkspaceManifest.fields,
  manifestSha256: Schema.OptionFromOptionalKey(Schema.String.check(Schema.isPattern(SHA256_PATTERN))),
  capturedMachineId: Schema.OptionFromOptionalKey(MachineId),
  capturedAt: Schema.OptionFromOptionalKey(Schema.DateTimeUtcFromMillis),
  capturedSequence: Schema.OptionFromOptionalKey(Sequence),
});

export type WorkspaceSnapshot = typeof WorkspaceSnapshot.Type;

/** One captured generation retains its identity through upload and interruption. */
const CheckpointTransfer = Schema.Struct({
  generation: RecordId,
  /** Absent for the first committed generation. */
  parent: Schema.OptionFromNullOr(RecordId),
  machineId: MachineIdRow.fields.id,
  startedAt: Schema.DateTimeUtcFromMillis,
  /** Absent until the guest finishes and validates its archive. */
  archive: Schema.OptionFromNullOr(Schema.toType(SandboxArchive)),
  part: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  capturedSequence: Schema.OptionFromOptionalKey(Sequence),
  lease: Schema.Int,
  isAborting: Schema.Boolean.pipe(Schema.withDecodingDefaultKey(Effect.succeed(false))),
});

/** Why a file checkpoint exists; none of these operations executes a shell command. */
export const FileCheckpointPurpose = Schema.TaggedUnion({
  Automatic: { operationId: SandboxOperationId },
  Maintenance: { operationId: SandboxOperationId },
  Drain: { operationId: SandboxOperationId, machineId: MachineId },
  Activation: { operationId: SandboxOperationId },
  Recovery: { operationId: SandboxOperationId, ...SandboxRecoveryCheckpointRequest.fields },
});

export type FileCheckpointPurpose = typeof FileCheckpointPurpose.Type;

/** Filesystem generations advance independently of terminal command receipts. */
export const WorkspaceCheckpoint = Schema.Struct({ ...CheckpointTransfer.fields, purpose: FileCheckpointPurpose });

export type WorkspaceCheckpoint = typeof WorkspaceCheckpoint.Type;

/** Operation receipts survive retries independently of later changes to the committed head. */
export const FileCheckpointResult = SandboxCheckpointResult;

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
