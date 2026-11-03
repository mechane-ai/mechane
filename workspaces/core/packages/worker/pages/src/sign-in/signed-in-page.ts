import { COOKIE_LIFETIME, cookieHeader, CookieName, readCookie } from '@mechane/authentication';
import type { WorkerSettings } from '@mechane/bindings';
import { PagePath } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { escapeHtml } from '@mechane/utilities';
import { Duration, Option } from 'effect';
import { renderPage } from '../html/render-page.ts';
import type { PageHeader } from '../types.ts';
import { consoleDestination } from './console-destination.ts';

type SignedInPageInput = {
  readonly settings: WorkerSettings;
  readonly name: string;
  readonly sessionToken: string;
  readonly request: Request;
};

type RefreshHeaderInput = { readonly url: string };

/**
 * Sets the session cookie, clears the sign-in cookie, and returns to the approved destination with a refresh. The page
 * itself starts the refresh, so the browser sends the session's same-site cookie with it.
 */
export function signedInPage({ settings, name, sessionToken, request }: SignedInPageInput): Response {
  const destination = readCookie({ request, settings, cookie: CookieName.Destination });
  const path = Option.flatMap(destination, (value) => consoleDestination({ value, origin: settings.origin }));
  const destinationPath = Option.getOrElse(path, () => PagePath.Device);
  const next = new URL(destinationPath, settings.origin).href;
  const lifetime = COOKIE_LIFETIME[CookieName.Session];

  const headers: ReadonlyArray<PageHeader> = [
    // The refresh must not send the callback's OAuth code and state in Referer; the device page restores its policy.
    [HttpHeader.ReferrerPolicy, 'no-referrer'],
    [HttpHeader.Refresh, refreshHeader({ url: next })],
    [HttpHeader.SetCookie, cookieHeader({ cookie: CookieName.Session, value: sessionToken, lifetime, settings })],
    [HttpHeader.SetCookie, cookieHeader({ cookie: CookieName.SignIn, value: '', lifetime: Duration.zero, settings })],
    [
      HttpHeader.SetCookie,
      cookieHeader({ cookie: CookieName.Destination, value: '', lifetime: Duration.zero, settings }),
    ],
  ];

  const login = escapeHtml({ text: name });
  const continuation = escapeHtml({ text: next });
  const body = `<p>You are signed in as ${login}. <a href="${continuation}">Continue</a>.</p>`;

  return renderPage({ status: HttpStatusCode.Ok, title: 'Signed in', body, headers });
}

/** The `refresh` value that moves a browser on to `url` at once. */
function refreshHeader({ url }: RefreshHeaderInput): string {
  return `0; url=${url}`;
}
