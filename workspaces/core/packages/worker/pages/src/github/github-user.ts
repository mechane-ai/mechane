import type { WorkerSettings } from '@mechane/bindings';
import { callbackUrl, GitHubPath, GitHubTokenAnswer, GitHubTokenRequest } from '@mechane/protocol';
import type { GitHubUser } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Effect, Option, Schema } from 'effect';
import { GitHubStep, PageRefusal } from '../constants.ts';
import { GitHubRefused, PageRefused } from '../errors.ts';
import type { GitHubUnavailable } from '../errors.ts';
import { githubAnswer } from './github-answer.ts';
import { signedInUser } from './signed-in-user.ts';

type GitHubUserInput = { readonly settings: WorkerSettings; readonly authorizationCode: string };

/**
 * The GitHub user an authorization code signs in: the code buys an access token, which reads the user once and is then
 * dropped, so the deployment holds no GitHub token.
 */
export const githubUser = Effect.fn('githubUser')(function* ({
  settings,
  authorizationCode,
}: GitHubUserInput): Effect.fn.Return<GitHubUser, GitHubUnavailable | GitHubRefused | PageRefused> {
  if (Option.isNone(settings.githubClientId) || Option.isNone(settings.githubClientSecret)) {
    return yield* new PageRefused({ refusal: PageRefusal.SignInUnavailable });
  }

  const redirectUri = callbackUrl({ origin: settings.origin });
  const readClientSecret = settings.githubClientSecret.value;

  const clientSecret = yield* Effect.tryPromise({
    try: () => readClientSecret(),
    catch: () => new PageRefused({ refusal: PageRefusal.SignInUnavailable }),
  });

  const form = Schema.encodeSync(GitHubTokenRequest)({
    clientId: settings.githubClientId.value,
    clientSecret,
    code: authorizationCode,
    redirectUri,
  });

  const request = new Request(new URL(GitHubPath.AccessToken, settings.githubWebOrigin), {
    method: HttpMethod.Post,
    headers: { [HttpHeader.Accept]: MediaType.Json },
    body: new URLSearchParams(form),
  });

  const exchange = yield* githubAnswer({ request, step: GitHubStep.ExchangeCode, answer: GitHubTokenAnswer });

  if ('error' in exchange) {
    return yield* new GitHubRefused({ reason: exchange.error });
  }

  return yield* signedInUser({ settings, accessToken: exchange.accessToken });
});
