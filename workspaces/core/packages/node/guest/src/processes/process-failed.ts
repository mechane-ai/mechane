import { ProcessId } from '@mechane/sandbox-wire';
import { Schema } from 'effect';

/** A managed-process admission, spawn, or stop failed without proving successful execution. */
export class ProcessFailed extends Schema.TaggedError<ProcessFailed>()('ProcessFailed', {
  processId: ProcessId,
  reason: Schema.String,
}) {}
