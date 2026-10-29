import type { WorkerSettings } from '@mechane/bindings';
import { localSignInUrl } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { Effect, Option } from 'effect';
import { NO_STORE, PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';
import { startGithubSignIn } from './start-github-sign-in.ts';

type StartSignInInput = { readonly settings: WorkerSettings };

/** Starts the deployment's configured local or GitHub browser sign-in flow. */
export const startSignIn = Effect.fn('startSignIn')(function* ({
  settings,
}: StartSignInInput): Effect.fn.Return<Response, ObjectUnavailable | PageRefused> {
  if (Option.isSome(settings.localBootstrapSecret)) {
    const location = localSignInUrl({ origin: settings.origin }).href;

    return new Response(null, {
      status: HttpStatusCode.Found,
      headers: { [HttpHeader.Location]: location, [HttpHeader.CacheControl]: NO_STORE },
    });
  }

  if (Option.isNone(settings.githubClientId)) {
    return yield* new PageRefused({ refusal: PageRefusal.SignInUnavailable });
  }

  return yield* startGithubSignIn({ settings, clientId: settings.githubClientId.value });
});
