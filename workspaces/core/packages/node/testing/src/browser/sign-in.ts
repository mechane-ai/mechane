import { HttpStatusCode } from '@mechane/records';
import { Effect } from 'effect';
import { BrowserStep } from '../constants.ts';
import type { BrowserRefused } from '../errors.ts';
import { cookieHeader } from './cookie-header.ts';
import { expectedPage } from './expected-page.ts';
import { githubSignInResult } from './github-sign-in-result.ts';
import { keepCookies } from './keep-cookies.ts';
import { signInLocally } from './local-auth/sign-in-locally.ts';
import type { BrowserHeaders, SignedInBrowserInput } from './types.ts';

/** Signs in through the scenario's GitHub fixture or local bootstrap form and keeps the resulting session cookie. */
export const signIn = Effect.fn('signIn')(function* (
  input: SignedInBrowserInput,
): Effect.fn.Return<BrowserHeaders, BrowserRefused> {
  if ('bootstrapSecret' in input) {
    return yield* signInLocally(input);
  }

  const { started, returned } = yield* githubSignInResult(input);

  yield* expectedPage({ step: BrowserStep.ReturnFromGitHub, page: returned, expected: HttpStatusCode.Ok });

  return cookieHeader({ jar: keepCookies({ jar: started, page: returned }) });
});
