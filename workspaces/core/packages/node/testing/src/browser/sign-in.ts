import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { Effect } from 'effect';
import { BrowserStep } from '../constants.ts';
import type { BrowserRefused } from '../errors.ts';
import { cookieHeader } from './cookie-header.ts';
import { expectedPage } from './expected-page.ts';
import { keepCookies } from './keep-cookies.ts';
import { signInLocally } from './local-auth/sign-in-locally.ts';
import { redirectLocation } from './redirect-location.ts';
import { sentPage } from './sent-page.ts';
import type { BrowserHeaders, ExpectedStatus, Page, SendInput, SignedInBrowserInput } from './types.ts';

/** A request a step sends, and the status a person's browser expects of its answer. */
type BrowseInput = SendInput & ExpectedStatus;

/** Signs in through the scenario's GitHub fixture or local bootstrap form and keeps the resulting session cookie. */
export const signIn = Effect.fn('signIn')(function* (
  input: SignedInBrowserInput,
): Effect.fn.Return<BrowserHeaders, BrowserRefused> {
  if ('bootstrapSecret' in input) {
    return yield* signInLocally(input);
  }

  const { url, login } = input;

  const opened = yield* browse({
    step: BrowserStep.OpenDevicePage,
    request: new Request(url),
    expected: HttpStatusCode.Found,
  });

  const signInUrl = yield* redirectLocation({ page: opened, step: BrowserStep.OpenDevicePage });
  const form = new Request(signInUrl, { method: HttpMethod.Post, body: new URLSearchParams({ login }) });
  const signedIn = yield* browse({ step: BrowserStep.SignIn, request: form, expected: HttpStatusCode.Found });
  const callbackUrl = yield* redirectLocation({ page: signedIn, step: BrowserStep.SignIn });
  const started = keepCookies({ jar: new Map(), page: opened });
  const callback = new Request(callbackUrl, { headers: cookieHeader({ jar: started }) });

  const returned = yield* browse({
    step: BrowserStep.ReturnFromGitHub,
    request: callback,
    expected: HttpStatusCode.Ok,
  });

  return cookieHeader({ jar: keepCookies({ jar: started, page: returned }) });
});

/** Sends one request as a step that expects the status `expected`, and reads the page it answers with. */
const browse = Effect.fn('browse')(function* ({
  step,
  request,
  expected,
}: BrowseInput): Effect.fn.Return<Page, BrowserRefused> {
  const page = yield* sentPage({ step, request });

  return yield* expectedPage({ step, page, expected });
});
