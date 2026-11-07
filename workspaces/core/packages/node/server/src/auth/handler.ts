import { IdentityNotAdmitted, KeyMissing, RateLimited, RequestInvalid } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { hashAuthToken, limitAuthentication } from '@mechane/runtime';
import { Schema } from 'effect';
import { cookieHeader, readCookie, requireBrowserOrigin, validateAuthOrigin } from './cookies.ts';
import { showDevice, submitDevice } from './device.ts';
import { authPage, AuthPageError, escapeHtml } from './page.ts';
import { finishSignIn, startSignIn } from './sign-in.ts';
import type { AuthHandlerOptions, AuthRequest } from './types.ts';

const AUTH_PATHS: ReadonlySet<string> = new Set([
  '/auth/sign-in',
  '/auth/github/callback',
  '/auth/sign-out',
  '/device',
]);

async function signOut({ request, store, configuration }: AuthRequest): Promise<Response> {
  requireBrowserOrigin(request, configuration.origin);

  const token = readCookie({ request, origin: configuration.origin, name: 'session' });

  if (token !== null) {
    await store.auth.closeSession({ tokenHash: hashAuthToken(token) });
  }

  const state = readCookie({ request, origin: configuration.origin, name: 'sign_in' });

  if (state !== null) {
    await store.auth.claimSignIn({ tokenHash: hashAuthToken(state) });
  }

  const headers = new Headers({ location: '/console', [HttpHeader.CacheControl]: 'no-store' });

  headers.append(
    HttpHeader.SetCookie,
    cookieHeader({ origin: configuration.origin, name: 'session', value: '', maxAgeSeconds: 0 }),
  );
  headers.append(
    HttpHeader.SetCookie,
    cookieHeader({ origin: configuration.origin, name: 'sign_in', value: '', maxAgeSeconds: 0 }),
  );

  return new Response(null, { status: HttpStatusCode.SeeOther, headers });
}

function pageFailure(failure: unknown): Response {
  if (failure instanceof AuthPageError) {
    return authPage({
      title: 'Unable to continue',
      content: `<p>${escapeHtml(failure.message)}</p><p><a href="/console">Return to Mechane</a></p>`,
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
      content: `<p>${escapeHtml(failure.reason)}</p>`,
      status: HttpStatusCode.BadRequest,
    });
  }

  return authPage({
    title: 'Temporarily unavailable',
    content: '<p>The service could not complete this request. Try again.</p>',
    status: HttpStatusCode.Unavailable,
  });
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

      switch (`${request.method} ${pathname}`) {
        case 'GET /auth/sign-in':
          return await startSignIn(input);
        case 'GET /auth/github/callback':
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
      return pageFailure(failure);
    }
  };
}
