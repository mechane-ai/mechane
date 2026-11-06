import { Array, Option, Result, Schema } from 'effect';

type HasConversationCacheInput = { readonly payload: unknown };

const CACHE_TYPE = 'ephemeral';

const CachedMessage = Schema.Struct({
  content: Schema.NonEmptyArray(Schema.Struct({ cache_control: Schema.Struct({ type: Schema.Literal(CACHE_TYPE) }) })),
});

const Request = Schema.Struct({ messages: Schema.Array(Schema.Unknown) });

/** Missing cache hints repeatedly charge the entire growing conversation at the uncached input rate. */
export function hasConversationCache({ payload }: HasConversationCacheInput): boolean {
  const decoded = Schema.decodeUnknownResult(Request)(payload);
  const request = Result.getSuccess(decoded);
  const final = Option.flatMap(request, ({ messages }) => Array.last(messages));
  const isCachedMessage = Schema.is(CachedMessage);

  return Option.exists(final, isCachedMessage);
}
