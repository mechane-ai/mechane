import { Schema } from 'effect';

/** The part of `mechane update`'s result the scenario reads: what it found or did, and the two releases. */
export const UpdateReport = Schema.Struct({ outcome: Schema.String, from: Schema.String, to: Schema.String });

export type UpdateReport = typeof UpdateReport.Type;
