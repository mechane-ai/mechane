import { serveRequests } from '@mechane/program';
import type { ServedAnswer, ServedRequest } from '@mechane/program';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { SCRIPTED_OFFERS } from '../constants.ts';
import type { StackFailed } from '../errors.ts';
import { stackListenFailure } from '../loopback/stack-listen-failure.ts';
import type { AnsweredRequest, ScriptedUpstream } from '../types.ts';
import { answerModelRequest } from './answer-model-request.ts';
import { SCRIPTED_MODEL_KEY, ScriptedPath } from './constants.ts';

/**
 * Serves the scripted model upstream on a loopback port until the scope closes. It needs no account and calls no model.
 * It remembers each request it answered with a reply, so a scenario can count and price the dispatches that reached
 * it.
 */
export const startScriptedUpstream = Effect.fn('startScriptedUpstream')(function* (): Effect.fn.Return<
  ScriptedUpstream,
  StackFailed,
  Scope.Scope
> {
  const answered: Array<AnsweredRequest> = [];

  const answer: (request: ServedRequest) => ServedAnswer = (request) => {
    const modelAnswer = answerModelRequest({ request });

    answered.push(...modelAnswer.answered);

    return modelAnswer;
  };

  const listening = serveRequests({ answer });
  const origin = yield* Effect.mapError(listening, stackListenFailure);

  return {
    upstream: new URL(ScriptedPath.Upstream, origin),
    apiKey: SCRIPTED_MODEL_KEY,
    offers: SCRIPTED_OFFERS,
    requests: () => [...answered],
  };
});
