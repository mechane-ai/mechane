import { BoundedTurn } from '@mechane/protocol';
import { Schema } from 'effect';

/** A bounded request returns its durable result or an explicit admission refusal. */
export const BoundedTurnAnswer = Schema.TaggedUnion({
  Found: { boundedTurn: BoundedTurn },
  MechMissing: {},
  RequestMissing: {},
  Conflicting: {},
  Archived: {},
});

export type BoundedTurnAnswer = typeof BoundedTurnAnswer.Type;
