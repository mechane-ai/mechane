import { HttpHeader } from '@mechane/records';
import { stringifyCookie } from 'cookie';
import { Record } from 'effect';
import type { BrowserHeaders, CookieJar } from './types.ts';

type CookieHeaderInput = { readonly jar: CookieJar };

/** The `cookie` header that sends every cookie of the jar. */
export function cookieHeader({ jar }: CookieHeaderInput): BrowserHeaders {
  return { [HttpHeader.Cookie]: stringifyCookie(Record.fromEntries(jar)) };
}
