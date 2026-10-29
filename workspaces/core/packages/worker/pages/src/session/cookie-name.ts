import type { WorkerSettings } from '@mechane/bindings';
import { OriginProtocol } from '@mechane/deployment';
import type { CookieName } from '../constants.ts';

type CookieNameInput = { readonly cookie: CookieName; readonly settings: WorkerSettings };

/** The prefix a browser accepts only on a secure, host-only cookie with `Path=/`; plain HTTP serves loopback only. */
const SECURE_COOKIE_PREFIX = '__Host-';

/** A cookie's name on the deployment: prefixed as secure and host-only, except on a loopback stack served over HTTP. */
export function cookieName({ cookie, settings }: CookieNameInput): string {
  if (settings.origin.protocol === OriginProtocol.Secure) {
    return `${SECURE_COOKIE_PREFIX}${cookie}`;
  }

  return cookie;
}
