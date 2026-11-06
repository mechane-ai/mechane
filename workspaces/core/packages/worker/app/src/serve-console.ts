import { CookieName, readCookie } from '@mechane/authentication';
import type { WorkerSettings } from '@mechane/bindings';
import { PagePath, WorkerMisconfigured } from '@mechane/protocol';
import { HttpHeader, HttpMethod } from '@mechane/records';
import { Effect, Option } from 'effect';

const READ_METHODS: ReadonlySet<string> = new Set([HttpMethod.Get, HttpMethod.Head]);
const CONSOLE_PREFIX = '/console/';
const CONSOLE_ROOTS: ReadonlySet<string> = new Set([PagePath.Console, CONSOLE_PREFIX]);
const EXTERNAL_NAVIGATION: ReadonlySet<string> = new Set(['cross-site', 'same-site']);
const CONSOLE_INDEX = `${CONSOLE_PREFIX}index.html`;
const CONSOLE_WELCOME = `${CONSOLE_PREFIX}welcome.html`;
const HASHED_ASSET = /^\/console\/assets\/[^/]+-[A-Za-z0-9_-]+\.(?:js|css|wasm)$/;

type ServeConsoleInput = { readonly request: Request; readonly url: URL; readonly settings: WorkerSettings };

/** Only the console namespace serves assets; a missing API route never falls back to HTML. */
export const serveConsole = Effect.fn('serveConsole')(function* ({
  request,
  url,
  settings,
}: ServeConsoleInput): Effect.fn.Return<Option.Option<Response>, WorkerMisconfigured> {
  if (!READ_METHODS.has(request.method)) {
    return Option.none();
  }

  if (url.pathname !== PagePath.Console && !url.pathname.startsWith(CONSOLE_PREFIX)) {
    return Option.none();
  }

  const target = new URL(url);

  if (CONSOLE_ROOTS.has(target.pathname)) {
    const session = readCookie({ request, settings, cookie: CookieName.Session });
    const site = request.headers.get(HttpHeader.SecFetchSite);
    // A Strict cookie can be absent on navigation from another site and present on subsequent same-origin reads.
    const originSite = Option.fromNullishOr(site);
    const external = Option.exists(originSite, (value) => EXTERNAL_NAVIGATION.has(value));
    target.pathname = CONSOLE_WELCOME;

    if (Option.isSome(session) || request.headers.has(HttpHeader.Authorization) || external) {
      target.pathname = CONSOLE_INDEX;
    }
  }

  target.search = '';
  const assetHeaders = new Headers(request.headers);

  assetHeaders.delete(HttpHeader.Authorization);
  assetHeaders.delete(HttpHeader.ProxyAuthorization);
  assetHeaders.delete(HttpHeader.Cookie);
  assetHeaders.delete(HttpHeader.Referer);

  const assetRequest = new Request(target, { method: request.method, headers: assetHeaders });

  const response = yield* Effect.tryPromise({
    try: () => settings.consoleAssets.fetch(assetRequest),
    catch: () => new WorkerMisconfigured({ reason: 'Console assets are unavailable' }),
  });

  const headers = new Headers(response.headers);

  headers.set(HttpHeader.XContentTypeOptions, 'nosniff');
  headers.set(HttpHeader.ReferrerPolicy, 'same-origin');
  headers.set(HttpHeader.CrossOriginOpenerPolicy, 'same-origin');
  headers.set(HttpHeader.CrossOriginEmbedderPolicy, 'require-corp');
  headers.set(HttpHeader.CacheControl, 'no-store');

  if (response.ok && HASHED_ASSET.test(target.pathname)) {
    headers.set(HttpHeader.CacheControl, 'public, max-age=31536000, immutable');
  }

  headers.set(HttpHeader.ContentSecurityPolicy, "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");

  const secured = new Response(response.body, { status: response.status, headers });

  return Option.some(secured);
});
