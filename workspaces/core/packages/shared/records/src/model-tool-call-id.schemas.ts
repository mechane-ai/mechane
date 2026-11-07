import { Schema } from 'effect';

/** AI SDK retains the provider's tool-call identity, which need not be a UUID. */
export const ModelToolCallId = Schema.NonEmptyString.pipe(Schema.brand('ModelToolCallId'));

export type ModelToolCallId = typeof ModelToolCallId.Type;
