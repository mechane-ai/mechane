import { StepSubject } from '@mechane/program';
import { Effect } from 'effect';
import { REQUEST_TIMEOUT } from '../constants.ts';
import { DeployFailed } from '../errors.ts';
import type { Answer, FetchAnswerInput } from './types.ts';

/**
 * Sends one request and reads its answer's body with `read`, all within the request timeout. A request that gets no
 * answer fails with its cause, naming its URL, and the caller decides what each status means.
 */
export function fetchAnswer<A>({ url, init, step, read }: FetchAnswerInput<A>): Effect.Effect<Answer<A>, DeployFailed> {
  const subjects = [StepSubject.cases.Url.make({ url })];

  return Effect.tryPromise({
    try: async (signal) => {
      const response = await fetch(url, { ...init, signal });

      return { status: response.status, isOk: response.ok, headers: response.headers, body: await read(response) };
    },
    catch: (cause) => new DeployFailed({ step, subjects, reason: String(cause) }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: REQUEST_TIMEOUT,
      orElse: () => Effect.fail(new DeployFailed({ step, subjects, reason: 'no answer in time' })),
    }),
  );
}
