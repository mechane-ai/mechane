import { callDirectory } from '@mechane/bindings';
import { tokenHash } from '@mechane/credentials';
import { GitHubCallbackQuery } from '@mechane/protocol';
import { IdentityProvider } from '@mechane/records';
import { SignInClaim } from '@mechane/rpc';
import { Effect, Match, Option, Record, Schema } from 'effect';
import { CookieName, PageRefusal } from '../constants.ts';
import { PageRefused } from '../errors.ts';
import { githubUser } from '../github/github-user.ts';
import { openBrowserSession } from '../session/open-browser-session.ts';
import { readCookie } from '../session/read-cookie.ts';
import type { PageFailure, PageInput } from '../types.ts';

/** Finishes a GitHub sign-in: the user that GitHub's code names opens a new browser session for the device page. */
export const finishSignIn = Effect.fn('finishSignIn')(function* ({
  request,
  url,
  settings,
}: PageInput): Effect.fn.Return<Response, PageFailure> {
  const authorizationCode = yield* claimReturn({ request, url, settings });
  const user = yield* githubUser({ settings, authorizationCode });
  const identity = { provider: IdentityProvider.GitHub, subject: String(user.id), name: user.login };

  return yield* openBrowserSession({ settings, identity });
});

/**
 * GitHub's authorization code from a return that carries the state of this browser's sign-in cookie, whose sign-in the
 * directory consumes once under the state's hash. A return with GitHub's error, such as a declined sign-in, has a page
 * of its own and starts no other sign-in.
 */
const claimReturn = Effect.fn('claimReturn')(function* ({
  request,
  url,
  settings,
}: PageInput): Effect.fn.Return<string, PageFailure> {
  const query: GitHubCallbackQuery = yield* Schema.decodeUnknownEffect(GitHubCallbackQuery)(
    Record.fromEntries(url.searchParams),
  ).pipe(Effect.mapError(() => new PageRefused({ refusal: PageRefusal.SignInInvalid })));

  if ('error' in query) {
    return yield* new PageRefused({ refusal: PageRefusal.SignInDenied });
  }

  const { authorizationCode, state } = query;
  const cookieState = readCookie({ request, cookie: CookieName.SignIn, settings });

  if (Option.isNone(cookieState) || cookieState.value !== state) {
    return yield* new PageRefused({ refusal: PageRefusal.SignInInvalid });
  }

  const stateHash = yield* tokenHash({ token: state });

  const claim = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.claimSignIn({ stateHash }),
    answer: SignInClaim,
  });

  return yield* Match.valueTags(claim, {
    Claimed: () => Effect.succeed(authorizationCode),
    Unclaimable: () => new PageRefused({ refusal: PageRefusal.SignInInvalid }),
  });
});
