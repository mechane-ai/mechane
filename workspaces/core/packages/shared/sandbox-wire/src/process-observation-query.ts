import { Schema } from 'effect';

/** Explicit tool observations may renew activity; passive Console observations may not. */
export const ProcessObservationQuery = Schema.Struct({ touch: Schema.fromJsonString(Schema.Boolean) });
