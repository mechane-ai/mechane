import { Thread } from '@mechane/protocol';
import { Schema } from 'effect';

/** A mech's threads as `mechane thread list` answers them, when the mech opened one. */
export const OneThread = Schema.Struct({ threads: Schema.Tuple([Thread]) });

export type OneThread = typeof OneThread.Type;
