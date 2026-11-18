import { RecordId } from '@mechane/records';
import { SandboxRecoveryCheckpointRefusalReason, WorkspaceStep } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

export const WorkspaceTransferPhase = {
  Request: 'request',
  ResponseBody: 'response_body',
  Archive: 'archive',
  Parts: 'part_transfer',
  Manifest: 'manifest',
} as const;

export type WorkspaceTransferPhase = (typeof WorkspaceTransferPhase)[keyof typeof WorkspaceTransferPhase];

/** A maintenance request cannot proceed without violating its recorded workspace intent. */
export class PortableMaintenanceRefused extends Schema.TaggedError<PortableMaintenanceRefused>()(
  'PortableMaintenanceRefused',
  { reason: Schema.String },
) {}

/** A workspace transfer could not complete its requested operation. */
export class WorkspaceTransferFailed extends Schema.TaggedError<WorkspaceTransferFailed>()('WorkspaceTransferFailed', {
  generation: RecordId,
  step: Schema.Enum(WorkspaceStep),
  reason: Schema.String,
  observation: Schema.optionalKey(
    Schema.Struct({
      phase: Schema.Enum(WorkspaceTransferPhase),
      elapsed: Schema.DurationFromMillis,
      part: Schema.optionalKey(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
    }),
  ),
}) {}

export class RecoveryCheckpointRefused extends Schema.TaggedError<RecoveryCheckpointRefused>()(
  'RecoveryCheckpointRefused',
  { reason: Schema.Enum(SandboxRecoveryCheckpointRefusalReason) },
) {}
