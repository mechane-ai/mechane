import { Schema } from 'effect';

/** The groups a persistent runtime owns, with readiness proving that its complete process tree was observed. */
export const CelldOwner = Schema.Struct({
  processGroups: Schema.Array(Schema.Int.check(Schema.isGreaterThan(0))),
  isReady: Schema.Boolean,
});

export type CelldOwner = typeof CelldOwner.Type;
