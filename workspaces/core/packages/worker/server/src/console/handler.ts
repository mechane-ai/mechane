import { HttpHeader, HttpMethod, HttpStatusCode } from '@mechane/records';
import { Schema } from 'effect';
import type { RequestHandler } from '../application.ts';
import { READ_METHODS } from '../http/methods.ts';
import { consoleAssetPath } from './paths.ts';

const CONSOLE_ROOT = '/console';
const CONSOLE_PREFIX = `${CONSOLE_ROOT}/`;
const IMMUTABLE_ASSET_SECONDS = 31_536_000;
const HASHED_ASSET = /^assets\/(?:[^/]+\/)*[^/]+-[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/u;
const UNSAFE_PATH_SEGMENTS: ReadonlySet<string> = new Set(['.', '..']);

type AssetBinding = { readonly fetch: (request: Request) => Promise<Response> };
type ConsoleHandlerOptions = { readonly assets: AssetBinding };

function securityHeaders(): Headers {
  return new Headers({
    [HttpHeader.CacheControl]: 'no-store',
    [HttpHeader.XContentTypeOptions]: 'nosniff',
    [HttpHeader.ReferrerPolicy]: 'same-origin',
    [HttpHeader.CrossOriginOpenerPolicy]: 'same-origin',
    [HttpHeader.CrossOriginEmbedderPolicy]: 'require-corp',
    [HttpHeader.ContentSecurityPolicy]: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  });
}

export function createConsoleHandler({ assets }: ConsoleHandlerOptions): RequestHandler {
  return async function consoleRequest(request) {
    if (!READ_METHODS.has(request.method)) {
      return null;
    }

    const url = new URL(request.url);

    if (url.pathname === '/') {
      const headers = securityHeaders();

      headers.set(HttpHeader.Location, CONSOLE_PREFIX);

      return new Response(null, { status: HttpStatusCode.Found, headers });
    }

    if (url.pathname !== CONSOLE_ROOT && !url.pathname.startsWith(CONSOLE_PREFIX)) {
      return null;
    }

    const headers = securityHeaders();

    if (url.pathname === CONSOLE_ROOT) {
      headers.set(HttpHeader.Location, `${CONSOLE_PREFIX}${url.search}`);

      return new Response(null, { status: HttpStatusCode.Found, headers });
    }

    const decoded = Schema.decodeUnknownResult(Schema.StringFromUriComponent)(url.pathname);

    if (decoded._tag === 'Failure') {
      return new Response('Invalid console path', { status: HttpStatusCode.BadRequest, headers });
    }

    const key = decoded.success.slice(CONSOLE_PREFIX.length);

    if (
      key.split('/').some((segment) => UNSAFE_PATH_SEGMENTS.has(segment)) ||
      key.includes('\\') ||
      key.includes('\0')
    ) {
      return new Response('Invalid console path', { status: HttpStatusCode.BadRequest, headers });
    }

    const isAsset = key === 'assets' || key.startsWith('assets/');
    const hasExtension = key.split('/').at(-1)?.includes('.') ?? false;
    const assetUrl = new URL(request.url);

    assetUrl.pathname = consoleAssetPath({ key, isAsset, hasExtension });

    const assetRequest = new Request(assetUrl, request);

    assetRequest.headers.delete(HttpHeader.Cookie);
    assetRequest.headers.delete(HttpHeader.Authorization);
    assetRequest.headers.delete(HttpHeader.ProxyAuthorization);

    const upstream = await assets.fetch(assetRequest);
    const responseHeaders = new Headers(upstream.headers);

    responseHeaders.delete(HttpHeader.SetCookie);

    for (const [name, value] of headers) {
      responseHeaders.set(name, value);
    }

    if (upstream.ok && HASHED_ASSET.test(key)) {
      responseHeaders.set(HttpHeader.CacheControl, `public, max-age=${IMMUTABLE_ASSET_SECONDS}, immutable`);
    }

    if (request.method === HttpMethod.Head) {
      await upstream.body?.cancel();

      return new Response(null, { status: upstream.status, headers: responseHeaders });
    }

    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  };
}
