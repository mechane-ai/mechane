import { parseSetCookie } from 'cookie';
import { Option, Predicate } from 'effect';
import type { CookieJar, Page } from './types.ts';

type KeepCookiesInput = { readonly jar: CookieJar; readonly page: Page };

/** A cookie a page sets, as its `set-cookie` header parses. */
type SetCookie = ReturnType<typeof parseSetCookie>;

/** A cookie of the jar: its name and its value. */
type JarEntry = readonly [string, string];

/** The jar with each cookie the page sets, without each one it expires. */
export function keepCookies({ jar, page }: KeepCookiesInput): CookieJar {
  const set = page.headers.getSetCookie().map((header) => parseSetCookie(header));
  const isSet: (entry: JarEntry) => boolean = ([name]) => set.some((cookie) => cookie.name === name);
  const isLive: (cookie: SetCookie) => boolean = (cookie) => cookie.maxAge !== 0;

  const entry: (cookie: SetCookie) => ReadonlyArray<JarEntry> = (cookie) =>
    Option.toArray(Option.map(Option.fromNullishOr(cookie.value), (value) => [cookie.name, value] as const));

  return new Map([...[...jar.entries()].filter(Predicate.not(isSet)), ...set.filter(isLive).flatMap(entry)]);
}
