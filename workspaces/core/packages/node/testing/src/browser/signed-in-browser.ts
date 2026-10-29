import { HttpHeader, HttpMethod } from '@mechane/records';
import { Effect } from 'effect';
import { BrowserStep } from '../constants.ts';
import type { BrowserRefused } from '../errors.ts';
import { formFields } from './form-fields.ts';
import { formOrigin } from './form-origin.ts';
import { sentPage } from './sent-page.ts';
import { signIn } from './sign-in.ts';
import type { BrowserHeaders, Page, SignedInBrowserInput } from './types.ts';

/** The page whose form to post, with fields to set beside or over its hidden ones. */
type SubmitInput = { readonly page: Page; readonly fields: Readonly<Record<string, string>> };

/** The URL of a page to open. */
type UrlInput = { readonly url: URL };

/**
 * A browser signed in at the local GitHub, with the deployment's cookies. It opens a page, or posts a page's form with
 * its hidden fields and the fields a person types. It posts from the origin the page's referrer policy lets it send.
 */
type Browser = {
  readonly open: (input: UrlInput) => Effect.Effect<Page, BrowserRefused>;
  readonly submit: (input: SubmitInput) => Effect.Effect<Page, BrowserRefused>;
};

/** A form to post with the browser's headers. */
type FormRequestInput = SubmitInput & { readonly headers: BrowserHeaders };

/**
 * A person's browser over plain HTTP, signed in as `login`. It opens the device page at `url` without a session, which
 * sends it through the local GitHub and back with the session's cookie. It then follows no redirect itself.
 */
export const signedInBrowser = Effect.fn('signedInBrowser')(function* (
  input: SignedInBrowserInput,
): Effect.fn.Return<Browser, BrowserRefused> {
  const headers = yield* signIn(input);

  const open: Browser['open'] = ({ url: pageUrl }) =>
    sentPage({ step: BrowserStep.Open, request: new Request(pageUrl, { headers }) });

  const submit: Browser['submit'] = ({ page, fields }) =>
    sentPage({ step: BrowserStep.PostForm, request: formRequest({ page, fields, headers }) });

  return { open, submit };
});

/** The post of a page's form: its hidden fields and the typed ones, from the origin its referrer policy sends. */
function formRequest({ page, fields, headers }: FormRequestInput): Request {
  return new Request(page.url, {
    method: HttpMethod.Post,
    headers: { ...headers, [HttpHeader.Origin]: formOrigin({ page }) },
    body: new URLSearchParams({ ...formFields({ page }), ...fields }),
  });
}
