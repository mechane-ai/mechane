import { SandboxArchive } from '@mechane/protocol';
import { RecordId } from '@mechane/records';
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

/** A settled receipt awaiting durable archive upload and atomic head publication. */
export const WorkspaceCheckpoint = Schema.Struct({
  generation: RecordId,
  /** Absent for the first committed generation. */
  parent: Schema.OptionFromNullOr(RecordId),
  machineId: MachineIdRow.fields.id,
  executionId: ExecutionId,
  receipt: SettledReceipt,
  startedAt: Schema.DateTimeUtcFromMillis,
  /** Absent until the guest finishes and validates its archive. */
  archive: Schema.OptionFromNullOr(Schema.toType(SandboxArchive)),
  part: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
});

export type WorkspaceCheckpoint = typeof WorkspaceCheckpoint.Type;

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
