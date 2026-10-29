import type { Schema } from 'effect';
import type { ServerFailure } from './errors.ts';

/** The schema of a failure the Worker answers with: a tagged error whose identifier is the failure's code. */
export type FailureCodec = Schema.Codec<ServerFailure, unknown> & {
  readonly identifier: string;
  readonly fields: Schema.Struct.Fields;
};
