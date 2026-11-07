import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Data, Effect, Result, Schema } from 'effect';
import { readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';
import { READ_METHODS } from '../http/methods.ts';

const CONSOLE_ROOT = '/console';
const CONSOLE_PREFIX = `${CONSOLE_ROOT}/`;
const INDEX_FILE = 'index.html';
const ASSET_FOLDER = 'assets';
const ASSET_PREFIX = `${ASSET_FOLDER}/`;
const IMMUTABLE_ASSET_SECONDS = 31_536_000;
const HASHED_ASSET = /^assets\/(?:[^/]+\/)*[^/]+-[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/u;
const UNSAFE_PATH_SEGMENTS: ReadonlySet<string> = new Set(['.', '..']);

const CONTENT_TYPES: Readonly<Record<string, MediaType>> = {
  '.html': MediaType.Html,
  '.js': MediaType.JavaScript,
  '.mjs': MediaType.JavaScript,
  '.css': MediaType.Css,
  '.wasm': MediaType.WebAssembly,
  '.svg': MediaType.Svg,
  '.png': MediaType.Png,
  '.jpg': MediaType.Jpeg,
  '.jpeg': MediaType.Jpeg,
  '.gif': MediaType.Gif,
  '.webp': MediaType.Webp,
  '.ico': MediaType.Icon,
  '.woff2': MediaType.Woff2,
  '.json': MediaType.Json,
  '.map': MediaType.Json,
  '.webmanifest': MediaType.Json,
  '.txt': MediaType.Utf8PlainText,
};

type ConsoleHandlerOptions = { readonly directory: string };
type ConsoleAssetKey = { readonly key: string };
type ConsoleHandler = (request: Request) => Promise<Response | null>;
type ConsoleAssetFailureDetails = { readonly path: string; readonly reason: string; readonly cause?: unknown };

type ConsoleResponseInput = {
  readonly request: Request;
  readonly body: string | Uint8Array<ArrayBuffer> | null;
  readonly status: HttpStatusCode;
  readonly headers: Headers;
};

class ConsoleAssetFailure extends Data.TaggedError('ConsoleAssetFailure')<ConsoleAssetFailureDetails> {}

function assetInventory({ directory }: ConsoleHandlerOptions): ReadonlyMap<string, string> {
  const root = resolve(directory);

  const listing = Effect.try({
    try: () => readdirSync(root, { recursive: true, withFileTypes: true }),
    catch: (cause) => new ConsoleAssetFailure({ path: root, reason: 'Console files could not be listed', cause }),
  });

  const entries = Effect.runSync(listing);

  if (entries.some((entry) => entry.isSymbolicLink())) {
    throw new ConsoleAssetFailure({ path: root, reason: 'Console files must not contain symbolic links' });
  }

  const paths = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
  const files = new Map(paths.map((path) => [relative(root, path).split(sep).join('/'), path]));

  if (!files.has(INDEX_FILE)) {
    throw new ConsoleAssetFailure({ path: root, reason: 'Console index is missing' });
  }

  return files;
}

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

function consoleResponse({ request, body, status, headers }: ConsoleResponseInput): Response {
  if (request.method === HttpMethod.Head) {
    return new Response(null, { status, headers });
  }

  return new Response(body, { status, headers });
}

function contentType({ key }: ConsoleAssetKey): MediaType {
  const mediaType = CONTENT_TYPES[extname(key).toLowerCase()];

  if (mediaType !== undefined) {
    return mediaType;
  }

  return MediaType.OctetStream;
}

function isInvalidPath({ key }: ConsoleAssetKey): boolean {
  const segments = key.split('/');

  return segments.some((segment) => UNSAFE_PATH_SEGMENTS.has(segment)) || key.includes('\\') || key.includes('\0');
}

export function createConsoleHandler({ directory }: ConsoleHandlerOptions): ConsoleHandler {
  const files = assetInventory({ directory });

  return async (request) => {
    if (!READ_METHODS.has(request.method)) {
      return null;
    }

    const url = new URL(request.url);

    if (url.pathname !== CONSOLE_ROOT && !url.pathname.startsWith(CONSOLE_PREFIX)) {
      return null;
    }

    const headers = securityHeaders();

    if (url.pathname === CONSOLE_ROOT) {
      headers.set(HttpHeader.Location, `${CONSOLE_PREFIX}${url.search}`);

      return consoleResponse({ request, body: null, status: HttpStatusCode.Found, headers });
    }

    const decoded = Schema.decodeUnknownResult(Schema.StringFromUriComponent, { onExcessProperty: 'error' })(
      url.pathname,
    );

    if (Result.isFailure(decoded)) {
      return consoleResponse({ request, body: 'Invalid console path', status: HttpStatusCode.BadRequest, headers });
    }

    const key = decoded.success.slice(CONSOLE_PREFIX.length);

    if (isInvalidPath({ key })) {
      return consoleResponse({ request, body: 'Invalid console path', status: HttpStatusCode.BadRequest, headers });
    }

    const isApplicationRoute = key !== ASSET_FOLDER && !key.startsWith(ASSET_PREFIX) && extname(key) === '';

    const selectedKey: string = (() => {
      if (!files.has(key) && isApplicationRoute) {
        return INDEX_FILE;
      }

      return key;
    })();

    const path = files.get(selectedKey);

    if (path === undefined) {
      return consoleResponse({ request, body: 'Console asset not found', status: HttpStatusCode.NotFound, headers });
    }

    const reading = Effect.tryPromise({
      try: () => readFile(path),
      catch: (cause) => new ConsoleAssetFailure({ path, reason: 'Console file could not be read', cause }),
    });

    const content = await Effect.runPromise(reading);
    const body = new Uint8Array(content);
    const mediaType = contentType({ key: selectedKey });

    headers.set(HttpHeader.ContentType, mediaType);
    headers.set(HttpHeader.ContentLength, String(body.byteLength));

    if (HASHED_ASSET.test(selectedKey)) {
      headers.set(HttpHeader.CacheControl, `public, max-age=${IMMUTABLE_ASSET_SECONDS}, immutable`);
    }

    return consoleResponse({ request, body, status: HttpStatusCode.Ok, headers });
  };
}
