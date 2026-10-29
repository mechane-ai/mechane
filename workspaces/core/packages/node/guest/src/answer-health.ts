import type { RouteNotFound } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { Effect } from 'effect';
import type { ServedAnswer } from './types.ts';

/** The method and the path's segments below the resource of a request for the machine, and the answer of any other. */
type AnswerHealthInput = {
  readonly method: string;
  readonly rest: ReadonlyArray<string>;
  readonly notFound: RouteNotFound;
};

/** Answers the machine's health, which only a `GET` of the resource itself reads. */
export const answerHealth = Effect.fn('answerHealth')(function* ({
  method,
  rest,
  notFound,
}: AnswerHealthInput): Effect.fn.Return<ServedAnswer, RouteNotFound> {
  if (method !== HttpMethod.Get || rest.length > 0) {
    return yield* notFound;
  }

  return { status: HttpStatusCode.NoContent, headers: {}, body: '' };
});
