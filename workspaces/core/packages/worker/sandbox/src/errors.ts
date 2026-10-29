import { RecordId } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

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
}) {}
