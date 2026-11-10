import { BrowserAuthenticationPath } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { cookieHeader, isBrowserAuthentication, readCookieTokenHash } from './cookies.ts';
import type { AuthRequest } from './types.ts';

type ExpireSignOutCookiesInput = { readonly request: Request; readonly origin: string; readonly response: Response };

export function expireSignOutCookies({ request, origin, response }: ExpireSignOutCookiesInput): Response {
  if (request.method !== HttpMethod.Post || new URL(request.url).pathname !== BrowserAuthenticationPath.SignOut) {
    return response;
  }

  if (!isBrowserAuthentication({ request, origin })) {
    return response;
  }

  const headers = new Headers(response.headers);

  headers.set(HttpHeader.CacheControl, 'no-store');
  headers.append(HttpHeader.SetCookie, cookieHeader({ origin, name: 'session', value: '', maxAgeSeconds: 0 }));
  headers.append(HttpHeader.SetCookie, cookieHeader({ origin, name: 'sign_in', value: '', maxAgeSeconds: 0 }));

  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function signOut({ request, store, configuration }: AuthRequest): Promise<Response> {
  const tokenHash = readCookieTokenHash({ request, origin: configuration.origin, name: 'session' });
  const signInTokenHash = readCookieTokenHash({ request, origin: configuration.origin, name: 'sign_in' });

  await store.auth.closeSession({ tokenHash, signInTokenHash });

  const response = new Response(null, { status: HttpStatusCode.Ok, headers: { location: '/console' } });

  return expireSignOutCookies({ request, origin: configuration.origin, response });
}
