import {
  BrowserAuthenticationPath,
  IdentityNotAdmitted,
  KeyMissing,
  RateLimited,
  RequestInvalid,
} from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { limitAuthentication } from '@mechane/runtime';
import { escapeHtml } from '@mechane/utilities';
import { Schema } from 'effect';
import { authenticationChallenge } from '../http/authentication-challenge.ts';
import { browserAuthenticationPage } from './browser-page.ts';
import { requireBrowserAuthentication, validateAuthOrigin } from './cookies.ts';
import { showDevice, submitDevice } from './device.ts';
import { authPage, AuthPageError } from './page.ts';
import { finishSignIn, startSignIn } from './sign-in.ts';
import { expireSignOutCookies, signOut } from './sign-out.ts';
import type { AuthHandlerOptions } from './types.ts';

const AUTH_PATHS: ReadonlySet<string> = new Set([
  BrowserAuthenticationPath.SignIn,
  BrowserAuthenticationPath.Callback,
  BrowserAuthenticationPath.SignOut,
  '/device',
]);

function renderPageFailure(failure: unknown): Response {
  if (failure instanceof AuthPageError) {
    return authPage({
      title: 'Unable to continue',
      content: `<p>${escapeHtml({ value: failure.message })}</p><p><a href="/console">Return to Mechane</a></p>`,
      status: failure.status,
    });
  }

  if (Schema.is(RateLimited)(failure)) {
    const headers = new Headers({ [HttpHeader.RetryAfter]: String(failure.retryAfterSeconds) });

    return authPage({
      title: 'Try again shortly',
      content: `<p>Too many attempts. Try again in ${failure.retryAfterSeconds} seconds.</p>`,
      status: HttpStatusCode.TooManyRequests,
      headers,
    });
  }

  if (Schema.is(IdentityNotAdmitted)(failure)) {
    return authPage({
      title: 'Access unavailable',
      content: '<p>This GitHub identity is not admitted to this installation.</p>',
      status: HttpStatusCode.Forbidden,
    });
  }

  if (Schema.is(KeyMissing)(failure)) {
    return authPage({
      title: 'Sign in again',
      content:
        '<p>Your browser session expired.</p><p><a href="/auth/sign-in?returnTo=%2Fdevice">Sign in with GitHub</a></p>',
      status: HttpStatusCode.Unauthorized,
    });
  }

  if (Schema.is(RequestInvalid)(failure)) {
    return authPage({
      title: 'Invalid request',
      content: `<p>${escapeHtml({ value: failure.reason })}</p>`,
      status: HttpStatusCode.BadRequest,
    });
  }

  return authPage({
    title: 'Temporarily unavailable',
    content: '<p>The service could not complete this request. Try again.</p>',
    status: HttpStatusCode.Unavailable,
  });
}

type PageFailureInput = { readonly failure: unknown; readonly request: Request };

function pageFailure({ failure, request }: PageFailureInput): Response {
  const response = renderPageFailure(failure);

  if (response.status === HttpStatusCode.Unauthorized) {
    response.headers.set(HttpHeader.WwwAuthenticate, authenticationChallenge({ request }));
  }

  return response;
}

export function createAuthHandler({ store, configuration }: AuthHandlerOptions) {
  validateAuthOrigin(configuration.origin);

  return async function handleAuth(request: Request, peerAddress: string | null = null): Promise<Response | null> {
    const pathname = new URL(request.url).pathname;

    if (!AUTH_PATHS.has(pathname)) {
      return null;
    }

    try {
      await limitAuthentication({ store, configuration, policy: 'address', subject: peerAddress ?? 'unavailable' });

      const input = { request, store, configuration, peerAddress };

      if (request.method === HttpMethod.Post && pathname !== '/device') {
        requireBrowserAuthentication({ request, origin: configuration.origin });
      }

      switch (`${request.method} ${pathname}`) {
        case 'GET /auth/sign-in':
        case 'GET /auth/github/callback':
          return browserAuthenticationPage({ isSigningOut: false });
        case 'GET /auth/sign-out':
          return browserAuthenticationPage({ isSigningOut: true });
        case 'POST /auth/sign-in':
          return await startSignIn(input);
        case 'POST /auth/github/callback':
          return await finishSignIn(input);
        case 'POST /auth/sign-out':
          return await signOut(input);
        case 'GET /device':
          return await showDevice(input);
        case 'POST /device':
          return await submitDevice(input);
        default:
          return authPage({
            title: 'Method not allowed',
            content: '<p>This page does not accept that request method.</p>',
            status: HttpStatusCode.MethodNotAllowed,
          });
      }
    } catch (failure) {
      const response = pageFailure({ failure, request });

      return expireSignOutCookies({ request, origin: configuration.origin, response });
    }
  };
}
