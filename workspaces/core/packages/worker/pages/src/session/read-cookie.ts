import type { WorkerSettings } from '@mechane/bindings';
import { HttpHeader } from '@mechane/records';
import { parseCookie } from 'cookie';
import { Option } from 'effect';
import type { CookieName } from '../constants.ts';
import { cookieName } from './cookie-name.ts';

type ReadCookieInput = { readonly request: Request; readonly cookie: CookieName; readonly settings: WorkerSettings };

/** The value of one of the pages' cookies in the request, if the browser sent it. */
export function readCookie({ request, cookie, settings }: ReadCookieInput): Option.Option<string> {
  const header = Option.fromNullishOr(request.headers.get(HttpHeader.Cookie));

  if (Option.isNone(header)) {
    return Option.none();
  }

  const cookies = parseCookie(header.value);

  return Option.fromNullishOr(cookies[cookieName({ cookie, settings })]);
}
