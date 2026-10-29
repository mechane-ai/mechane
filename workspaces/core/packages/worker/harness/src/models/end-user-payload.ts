import { Schema } from 'effect';

/** A request's body as pi-ai builds it, and the end user the dispatch is sent for. */
type EndUserPayloadInput = { readonly payload: unknown; readonly endUserId: string };

/** The request's body with the end user's id in the chat-completions `user` field, which OpenRouter passes on. */
export function endUserPayload({ payload, endUserId }: EndUserPayloadInput): Readonly<Record<string, unknown>> {
  // pi-ai builds every chat-completions body as a JSON object.
  return { ...Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(payload), user: endUserId };
}
