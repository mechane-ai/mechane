import { UnansweredReason } from '@mechane/protocol';
import { Schema } from 'effect';

/** How a drone ended: with its final reply, its report, or without one, for the reason a turn would give. */
export const DroneEnding = Schema.TaggedUnion({
  Reported: { report: Schema.String },
  Unreported: { reason: Schema.Enum(UnansweredReason) },
});

export type DroneEnding = typeof DroneEnding.Type;
