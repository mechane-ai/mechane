import { Schema } from 'effect';

/**
 * What OpenRouter reports of the key it is called with: its credit limit, which must be set, its usage, and the credit
 * the limit leaves.
 */
export const OpenRouterKey = Schema.Struct({
  key: Schema.Struct({
    limitDollars: Schema.Number,
    usageDollars: Schema.Number,
    remainingDollars: Schema.Number,
  }).pipe(Schema.encodeKeys({ limitDollars: 'limit', usageDollars: 'usage', remainingDollars: 'limit_remaining' })),
}).pipe(Schema.encodeKeys({ key: 'data' }));

export type OpenRouterKey = typeof OpenRouterKey.Type;
