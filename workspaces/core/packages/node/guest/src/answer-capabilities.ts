import type { RouteNotFound } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { GuestCapabilities } from '@mechane/sandbox-wire';
import { Effect, Schema } from 'effect';
import type { ServedAnswer } from './types.ts';

type AnswerCapabilitiesInput = {
  readonly method: string;
  readonly rest: ReadonlyArray<string>;
  readonly notFound: RouteNotFound;
};

/** Declares mode-bearing checkpoints without changing the released bodyless archive route. */
export const answerCapabilities = Effect.fn('answerCapabilities')(function* ({
  method,
  rest,
  notFound,
}: AnswerCapabilitiesInput): Effect.fn.Return<ServedAnswer, RouteNotFound> {
  if (method !== HttpMethod.Get || rest.length > 0) {
    return yield* notFound;
  }

  const schema = Schema.fromJsonString(GuestCapabilities);
  const body = Schema.encodeSync(schema)({ isCheckpointSupported: true });

  return { status: HttpStatusCode.Ok, headers: { [HttpHeader.ContentType]: MediaType.Json }, body };
});
