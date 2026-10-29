import { SourceReport } from '@mechane/protocol';
import { Schema } from 'effect';

/** Source management distinguishes owner-visible refusal from missing or busy mechs. */
export const SourceAnswer = Schema.TaggedUnion({
  Found: { report: SourceReport },
  MechMissing: {},
  Busy: {},
  Refused: { reason: Schema.String },
});

export type SourceAnswer = typeof SourceAnswer.Type;
