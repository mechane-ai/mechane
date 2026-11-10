import { Schema } from 'effect';

/** A child process could not start, such as when its command is not on `PATH`, or did not exit in time. */
export class ProcessFailed extends Schema.TaggedError<ProcessFailed>()('ProcessFailed', {
  command: Schema.String,
  reason: Schema.String,
}) {}

/** A local listener could not bind or did not report its TCP address. */
export class LoopbackFailed extends Schema.TaggedError<LoopbackFailed>()('LoopbackFailed', { reason: Schema.String }) {}
