import { HttpStatusCode } from '@mechane/records';
import { Effect } from 'effect';
import { BrowserStep } from '../../constants.ts';
import type { BrowserRefused } from '../../errors.ts';
import { cookieHeader } from '../cookie-header.ts';
import { expectedPage } from '../expected-page.ts';
import { keepCookies } from '../keep-cookies.ts';
import type { BrowserHeaders } from '../types.ts';
import { submitBootstrap } from './submit-bootstrap.ts';

type SignInLocallyInput = { readonly url: URL; readonly bootstrapSecret: string };

/** Exchanges the local bootstrap secret for the browser cookie used by device approval. */
export const signInLocally = Effect.fn('signInLocally')(function* ({
  url,
  bootstrapSecret,
}: SignInLocallyInput): Effect.fn.Return<BrowserHeaders, BrowserRefused> {
  const page = yield* submitBootstrap({ url, secret: bootstrapSecret, origin: url.origin });

  yield* expectedPage({ step: BrowserStep.SignIn, page, expected: HttpStatusCode.Ok });

  const emptyJar = new Map<string, string>();
  const jar = keepCookies({ jar: emptyJar, page });

  return cookieHeader({ jar });
});
