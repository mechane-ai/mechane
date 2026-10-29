import { SourceGrantState, SourceReport } from '@mechane/protocol';
import { Schema } from 'effect';

/** Source management distinguishes owner-visible refusal from missing or busy mechs. */
export const SourceAnswer = Schema.TaggedUnion({
  Found: { report: SourceReport },
  MechMissing: {},
  Busy: {},
  Refused: { reason: Schema.String },
});

export type SourceAnswer = typeof SourceAnswer.Type;

/** Grant reads return only current metadata and never advance a checkout or publication. */
export const SourceGrantAnswer = Schema.TaggedUnion({ Found: { state: SourceGrantState }, MechMissing: {} });

export type SourceGrantAnswer = typeof SourceGrantAnswer.Type;
