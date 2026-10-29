import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { Effect } from 'effect';
import { BrowserStep } from '../constants.ts';
import type { BrowserRefused } from '../errors.ts';
import { cookieHeader } from './cookie-header.ts';
import { expectedPage } from './expected-page.ts';
import { keepCookies } from './keep-cookies.ts';
import { redirectLocation } from './redirect-location.ts';
import { sentPage } from './sent-page.ts';
import type { CookieJar, Page } from './types.ts';

type GithubSignInResultInput = { readonly url: URL; readonly login: string };
type GithubSignInResult = { readonly started: CookieJar; readonly returned: Page };

/** The callback remains observable when installation admission refuses a verified provider identity. */
export const githubSignInResult = Effect.fn('githubSignInResult')(function* ({
  url,
  login,
}: GithubSignInResultInput): Effect.fn.Return<GithubSignInResult, BrowserRefused> {
  const request = new Request(url);
  const opened = yield* sentPage({ step: BrowserStep.OpenDevicePage, request });

  yield* expectedPage({ step: BrowserStep.OpenDevicePage, page: opened, expected: HttpStatusCode.Found });

  const signInUrl = yield* redirectLocation({ page: opened, step: BrowserStep.OpenDevicePage });
  const body = new URLSearchParams({ login });
  const form = new Request(signInUrl, { method: HttpMethod.Post, body });
  const signedIn = yield* sentPage({ step: BrowserStep.SignIn, request: form });

  yield* expectedPage({ step: BrowserStep.SignIn, page: signedIn, expected: HttpStatusCode.Found });

  const callbackUrl = yield* redirectLocation({ page: signedIn, step: BrowserStep.SignIn });
  const jar: CookieJar = new Map();
  const started = keepCookies({ jar, page: opened });
  const headers = cookieHeader({ jar: started });
  const callback = new Request(callbackUrl, { headers });
  const returned = yield* sentPage({ step: BrowserStep.ReturnFromGitHub, request: callback });

  return { started, returned };
});
