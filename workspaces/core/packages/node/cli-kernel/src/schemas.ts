import { UpdateOutcome } from '@mechane/program';
import { ErrorFamily, Release } from '@mechane/protocol';
import { Schema } from 'effect';

/** What `mechane update` reports: what it found or did, the release it ran, the latest, and the binary it replaces. */
export const UpdateResult = Schema.Struct({
  outcome: Schema.Enum(UpdateOutcome),
  from: Release,
  to: Release,
  binary: Schema.String,
});

export type UpdateResult = typeof UpdateResult.Type;

/**
 * One error of a run: its code and message, and for an error a deployment answered, its family and its own fields under
 * the wire's keys.
 */
export const ErrorRecord = Schema.StructWithRest(
  Schema.Struct({
    code: Schema.String,
    message: Schema.String,
    /** None, as an omitted key, when no server answered with an error body. */
    family: Schema.OptionFromOptionalKey(Schema.Enum(ErrorFamily)),
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);

export type ErrorRecord = typeof ErrorRecord.Type;
