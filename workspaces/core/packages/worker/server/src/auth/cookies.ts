import { BROWSER_AUTHENTICATION_REQUEST, RequestInvalid } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { hashAuthToken } from '@mechane/runtime';

type CookieName = 'session' | 'sign_in';

type CookieInput = {
  readonly origin: string;
  readonly name: CookieName;
  readonly value: string;
  readonly maxAgeSeconds: number;
};

type ReadCookieInput = { readonly request: Request; readonly origin: string; readonly name: CookieName };
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(['localhost', '127.0.0.1', '[::1]']);

export function validateAuthOrigin(origin: string): void {
  const url = new URL(origin);
  const isLoopback = LOOPBACK_HOSTS.has(url.hostname);

  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLoopback)) {
    throw new Error('Authentication requires HTTPS or a loopback origin');
  }

  if (url.origin !== origin) {
    throw new Error('Authentication origin must not include a path');
  }
}

function cookieName(origin: string, name: CookieName): string {
  if (new URL(origin).protocol === 'https:') {
    return `__Host-mechane_${name}`;
  }

  return `mechane_${name}`;
}

export function cookieHeader({ origin, name, value, maxAgeSeconds }: CookieInput): string {
  const attributes = [
    `${cookieName(origin, name)}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (name === 'session') {
    attributes.push('SameSite=Strict');
  } else {
    attributes.push('SameSite=Lax');
  }

  if (new URL(origin).protocol === 'https:') {
    attributes.push('Secure');
  }

  return attributes.join('; ');
}

export function readCookie({ request, origin, name }: ReadCookieInput): string | null {
  const prefix = `${cookieName(origin, name)}=`;

  const matches = (request.headers.get(HttpHeader.Cookie) ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(prefix));

  if (matches.length !== 1) {
    return null;
  }

  const match = matches[0];

  if (match === undefined) {
    return null;
  }

  try {
    return decodeURIComponent(match.slice(prefix.length));
  } catch {
    return null;
  }
}

export function requireBrowserOrigin(request: Request, origin: string): void {
  if (request.headers.get(HttpHeader.Origin) !== origin) {
    throw new RequestInvalid({ reason: 'Browser writes require the installation origin' });
  }
}

export function readCookieTokenHash(input: ReadCookieInput): string | null {
  const token = readCookie(input);

  if (token === null) {
    return null;
  }

  return hashAuthToken(token);
}

type RequireBrowserAuthenticationInput = { readonly request: Request; readonly origin: string };

export function requireBrowserAuthentication({ request, origin }: RequireBrowserAuthenticationInput): void {
  if (!isBrowserAuthentication({ request, origin })) {
    throw new RequestInvalid({
      reason: 'Browser authentication requires the installation origin and coordinated header',
    });
  }
}

export function isBrowserAuthentication({ request, origin }: RequireBrowserAuthenticationInput): boolean {
  return (
    request.headers.get(HttpHeader.Origin) === origin &&
    request.headers.get(HttpHeader.BrowserAuthentication) === BROWSER_AUTHENTICATION_REQUEST
  );
}
