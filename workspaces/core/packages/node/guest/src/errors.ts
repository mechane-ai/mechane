import { RecordId } from '@mechane/records';
import { ExecutionId, WorkspaceStep } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

/** The guest's environment does not decode into its settings. */
export class GuestMisconfigured extends Schema.TaggedError<GuestMisconfigured>()('GuestMisconfigured', {
  reason: Schema.String,
}) {}

/** The guest could not listen on its host and port. */
export class GuestUnreachable extends Schema.TaggedError<GuestUnreachable>()('GuestUnreachable', {
  host: Schema.String,
  port: Schema.Int,
  reason: Schema.String,
}) {}

/** Bash did not start for an execution, such as when the machine can start no more processes or its home is gone. */
export class ExecutionUnstarted extends Schema.TaggedError<ExecutionUnstarted>()('ExecutionUnstarted', {
  executionId: ExecutionId,
  reason: Schema.String,
}) {}

/** An archive, transfer or restore failed before the workspace could be committed. */
export class WorkspaceFailed extends Schema.TaggedError<WorkspaceFailed>()('WorkspaceFailed', {
  generation: RecordId,
  step: Schema.Enum(WorkspaceStep),
  reason: Schema.String,
}) {}
