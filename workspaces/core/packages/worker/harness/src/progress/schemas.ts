import { Schema } from 'effect';
import { TurnFailure } from '../constants.ts';

/** How pi ended an input, an inbox item's turn or a drone's brief: with the reply, or without one and why. */
export const ItemEnded = Schema.TaggedUnion({
  Answered: { reply: Schema.String },
  Unanswered: { failure: Schema.Enum(TurnFailure) },
});

export type ItemEnded = typeof ItemEnded.Type;

/** An inbox item pi placed in a turn. */
export const ItemPlaced = Schema.TaggedStruct('Placed', {});

export type ItemPlaced = typeof ItemPlaced.Type;

/** A silent inbox item that entered the conversation. */
export const ItemWritten = Schema.TaggedStruct('Written', {});

export type ItemWritten = typeof ItemWritten.Type;
