import { HttpHeader } from '@mechane/records';
import { Effect, Option } from 'effect';
import type { BrowserStep } from '../constants.ts';
import { BrowserRefused } from '../errors.ts';
import type { Page } from './types.ts';

type RedirectLocationInput = { readonly page: Page; readonly step: BrowserStep };

/** Where a redirect page sends the browser; a page that names no location fails the step. */
export const redirectLocation = Effect.fn('redirectLocation')(function* ({
  page,
  step,
}: RedirectLocationInput): Effect.fn.Return<URL, BrowserRefused> {
  const location = Option.fromNullishOr(page.headers.get(HttpHeader.Location));

  if (Option.isNone(location)) {
    return yield* new BrowserRefused({ step, url: page.url, reason: 'the redirect names no location' });
  }

  return new URL(location.value);
});
