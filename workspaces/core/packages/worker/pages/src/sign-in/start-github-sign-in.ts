import { callDirectory } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { issueToken, tokenHash } from '@mechane/credentials';
import { authorizeUrl, callbackUrl, TokenPrefix } from '@mechane/protocol';
import type { ObjectUnavailable } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import type { GitHubClientId } from '@mechane/records';
import { Duration, Effect, Schema } from 'effect';
import { COOKIE_LIFETIME, CookieName, NO_STORE } from '../constants.ts';
import { cookieHeader } from '../session/cookie-header.ts';

type StartGithubSignInInput = { readonly settings: WorkerSettings; readonly clientId: GitHubClientId };

/** The callback must consume both this browser's cookie and the directory's hashed sign-in state. */
export const startGithubSignIn = Effect.fn('startGithubSignIn')(function* ({
  settings,
  clientId,
}: StartGithubSignInInput): Effect.fn.Return<Response, ObjectUnavailable> {
  const state = issueToken({ prefix: TokenPrefix.SignIn });
  const lifetime = COOKIE_LIFETIME[CookieName.SignIn];
  const lifetimeMs = Duration.toMillis(lifetime);
  const stateHash = yield* tokenHash({ token: state });

  yield* callDirectory({
    settings,
    call: ({ directory }) => directory.openSignIn({ signIn: { stateHash }, lifetimeMs }),
    answer: Schema.Undefined,
  });

  const redirectUri = callbackUrl({ origin: settings.origin });
  const authorizePage = authorizeUrl({ githubWebOrigin: settings.githubWebOrigin, clientId, redirectUri, state });
  const cookie = cookieHeader({ cookie: CookieName.SignIn, value: state, lifetime, settings });

  const headers = new Headers({
    [HttpHeader.Location]: authorizePage.href,
    [HttpHeader.CacheControl]: NO_STORE,
    [HttpHeader.SetCookie]: cookie,
  });

  return new Response(null, { status: HttpStatusCode.Found, headers });
});
