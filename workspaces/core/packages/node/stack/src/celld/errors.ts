import { Schema } from 'effect';

/** A health route did not answer yet, which startup retries until its deadline. */
export class WorkerUnreachable extends Schema.TaggedError<WorkerUnreachable>()('WorkerUnreachable', {
  url: Schema.URL,
}) {}
