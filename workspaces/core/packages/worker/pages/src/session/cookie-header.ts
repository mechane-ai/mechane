import type { WorkerSettings } from '@mechane/bindings';
import { OriginProtocol } from '@mechane/deployment';
import { stringifySetCookie } from 'cookie';
import { Duration } from 'effect';
import { CookieName } from '../constants.ts';
import { cookieName } from './cookie-name.ts';

/** A cookie to set for `lifetime`; a zero lifetime expires it at once. */
type CookieHeaderInput = {
  readonly cookie: CookieName;
  readonly value: string;
  readonly lifetime: Duration.Duration;
  readonly settings: WorkerSettings;
};

/**
 * The `SameSite` of each cookie: the session goes only with requests the deployment's own pages start, and the sign-in
 * also with the navigation back from GitHub, which another site starts.
 */
const COOKIE_SAME_SITE = { [CookieName.Session]: 'strict', [CookieName.SignIn]: 'lax' } as const;

/** The `set-cookie` value of one of the pages' cookies: host-only and unreadable by scripts, for its lifetime. */
export function cookieHeader({ cookie, value, lifetime, settings }: CookieHeaderInput): string {
  return stringifySetCookie({
    name: cookieName({ cookie, settings }),
    value,
    path: '/',
    httpOnly: true,
    secure: settings.origin.protocol === OriginProtocol.Secure,
    sameSite: COOKIE_SAME_SITE[cookie],
    maxAge: Duration.toSeconds(lifetime),
  });
}
