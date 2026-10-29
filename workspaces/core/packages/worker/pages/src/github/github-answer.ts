import type { ServiceFreeCodec } from '@mechane/protocol';
import { Duration, Effect, Schema } from 'effect';
import type { GitHubStep } from '../constants.ts';
import { GitHubUnavailable } from '../errors.ts';

/** How long one call to GitHub may take before the sign-in fails as unavailable. */
const GITHUB_TIMEOUT = Duration.seconds(10);

/** One call to GitHub: the request, the sign-in step it takes, which names its failure, and its answer's schema. */
type GitHubAnswerInput<S> = { readonly request: Request; readonly step: GitHubStep; readonly answer: S };

/** Sends one request to GitHub and decodes its JSON body, all within the deadline of one call. */
export const githubAnswer = Effect.fn('githubAnswer')(function* <S extends ServiceFreeCodec>({
  request,
  step,
  answer,
}: GitHubAnswerInput<S>): Effect.fn.Return<S['Type'], GitHubUnavailable> {
  const late = new GitHubUnavailable({ step, reason: `no answer within ${Duration.format(GITHUB_TIMEOUT)}` });

  return yield* decodedAnswer({ request, step, answer }).pipe(
    Effect.timeoutOrElse({ duration: GITHUB_TIMEOUT, orElse: () => Effect.fail(late) }),
  );
});

/**
 * Sends the request and decodes its JSON body. A redirect answers as itself, so no credential the request carries
 * follows one, and a failure's reason never quotes the body, which can hold a token.
 */
const decodedAnswer = Effect.fn('decodedAnswer')(function* <S extends ServiceFreeCodec>({
  request,
  step,
  answer,
}: GitHubAnswerInput<S>): Effect.fn.Return<S['Type'], GitHubUnavailable> {
  const response = yield* Effect.tryPromise({
    try: (signal) => fetch(request, { redirect: 'manual', signal }),
    catch: (cause) => new GitHubUnavailable({ step, reason: String(cause) }),
  });

  if (!response.ok) {
    return yield* new GitHubUnavailable({ step, reason: `GitHub answered with status ${response.status}` });
  }

  const body = yield* Effect.tryPromise({
    try: (): Promise<unknown> => response.json(),
    catch: () => new GitHubUnavailable({ step, reason: 'the body is not JSON' }),
  });

  return yield* Schema.decodeUnknownEffect(answer)(body).pipe(
    Effect.mapError(() => new GitHubUnavailable({ step, reason: 'the body is not in the shape GitHub documents' })),
  );
});
