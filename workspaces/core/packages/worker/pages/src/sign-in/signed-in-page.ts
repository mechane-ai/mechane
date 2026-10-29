import type { WorkerSettings } from '@mechane/bindings';
import { deviceUrl } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';
import { Duration } from 'effect';
import { COOKIE_LIFETIME, CookieName } from '../constants.ts';
import { renderPage } from '../html/render-page.ts';
import { cookieHeader } from '../session/cookie-header.ts';
import type { PageHeader } from '../types.ts';

type SignedInPageInput = { readonly settings: WorkerSettings; readonly name: string; readonly sessionToken: string };

type RefreshHeaderInput = { readonly url: string };

/**
 * Sets the session cookie, clears the sign-in cookie, and moves on to the device page with a refresh. The page itself
 * starts the refresh, so the browser sends the session's same-site cookie with it.
 */
export function signedInPage({ settings, name, sessionToken }: SignedInPageInput): Response {
  const next = deviceUrl({ origin: settings.origin }).href;
  const lifetime = COOKIE_LIFETIME[CookieName.Session];

  const headers: ReadonlyArray<PageHeader> = [
    // The refresh must not send the callback's OAuth code and state in Referer; the device page restores its policy.
    [HttpHeader.ReferrerPolicy, 'no-referrer'],
    [HttpHeader.Refresh, refreshHeader({ url: next })],
    [HttpHeader.SetCookie, cookieHeader({ cookie: CookieName.Session, value: sessionToken, lifetime, settings })],
    [HttpHeader.SetCookie, cookieHeader({ cookie: CookieName.SignIn, value: '', lifetime: Duration.zero, settings })],
  ];

  const login = escapeHtml({ text: name });
  const continuation = escapeHtml({ text: next });
  const body = `<p>You are signed in as ${login}. <a href="${continuation}">Continue to the code</a>.</p>`;

  return renderPage({ status: HttpStatusCode.Ok, title: 'Signed in', body, headers });
}

/** The `refresh` value that moves a browser on to `url` at once. */
function refreshHeader({ url }: RefreshHeaderInput): string {
  return `0; url=${url}`;
}
