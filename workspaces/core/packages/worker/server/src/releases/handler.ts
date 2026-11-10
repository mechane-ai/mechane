import {
  CliTarget,
  INSTALL_SCRIPT_PATH,
  RELEASE,
  ReleaseAsset,
  releaseAssetUrl,
  releaseBinaryKey,
  releaseBinaryName,
  ReleaseKey,
  releaseManifestKey,
} from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { Record } from 'effect';
import type { RequestHandler } from '../application.ts';
import { READ_METHODS } from '../http/methods.ts';
import { installScript } from './install-script.ts';
import { readReleaseManifest } from './manifest.ts';

const RELEASE_FETCH_TIMEOUT_MS = 120_000;
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable';
const CURRENT_RELEASE_CACHE = 'public, max-age=60';
type ReleaseHandlerInput = { readonly origin: string };
type ReleaseRoute = { readonly asset: string; readonly isManifest: boolean; readonly isImmutable: boolean };

function releaseRoutes({ origin }: ReleaseHandlerInput): ReadonlyMap<string, ReleaseRoute> {
  const versionedManifest = releaseManifestKey({ release: RELEASE });

  const routes = new Map<string, ReleaseRoute>([
    [
      new URL(ReleaseKey.Latest, origin).pathname,
      { asset: ReleaseAsset.Manifest, isManifest: true, isImmutable: false },
    ],
    [
      new URL(versionedManifest, origin).pathname,
      { asset: ReleaseAsset.Manifest, isManifest: true, isImmutable: true },
    ],
  ]);

  for (const target of Record.values(CliTarget)) {
    const key = releaseBinaryKey({ release: RELEASE, target });

    routes.set(new URL(key, origin).pathname, {
      asset: releaseBinaryName({ target }),
      isManifest: false,
      isImmutable: true,
    });
  }

  return routes;
}

export function createReleaseHandler({ origin }: ReleaseHandlerInput): RequestHandler {
  const installer = installScript({ origin });
  const routes = releaseRoutes({ origin });

  return async function handleRelease(request) {
    const path = new URL(request.url).pathname;

    if (path !== INSTALL_SCRIPT_PATH && !path.startsWith('/cli/')) {
      return null;
    }

    const headers = new Headers({ [HttpHeader.CacheControl]: 'no-store', [HttpHeader.XContentTypeOptions]: 'nosniff' });

    if (!READ_METHODS.has(request.method)) {
      headers.set('allow', 'GET, HEAD');

      return new Response(null, { status: HttpStatusCode.MethodNotAllowed, headers });
    }

    if (path === INSTALL_SCRIPT_PATH) {
      headers.set(HttpHeader.ContentType, MediaType.Utf8PlainText);
      headers.set(HttpHeader.CacheControl, CURRENT_RELEASE_CACHE);
      headers.set(HttpHeader.ContentLength, String(new TextEncoder().encode(installer).byteLength));

      if (request.method === HttpMethod.Head) {
        return new Response(null, { headers });
      }

      return new Response(installer, { headers });
    }

    const route = routes.get(path);

    if (route === undefined) {
      return new Response(null, { status: HttpStatusCode.NotFound, headers });
    }

    try {
      const upstream = await fetch(releaseAssetUrl({ name: route.asset }), {
        method: upstreamMethod({ request, route }),
        signal: AbortSignal.timeout(RELEASE_FETCH_TIMEOUT_MS),
      });

      if (!upstream.ok) {
        await upstream.body?.cancel();

        return new Response(null, { status: HttpStatusCode.BadGateway, headers });
      }

      if (route.isManifest) {
        const manifest = await readReleaseManifest(upstream);
        const body = JSON.stringify(manifest);

        headers.set(HttpHeader.ContentType, MediaType.Json);
        headers.set(HttpHeader.ContentLength, String(new TextEncoder().encode(body).byteLength));
        headers.set(HttpHeader.CacheControl, CURRENT_RELEASE_CACHE);

        if (route.isImmutable) {
          headers.set(HttpHeader.CacheControl, IMMUTABLE_CACHE);
        }

        if (request.method === HttpMethod.Head) {
          return new Response(null, { headers });
        }

        return new Response(body, { headers });
      }

      headers.set(HttpHeader.ContentType, MediaType.OctetStream);
      headers.set(HttpHeader.CacheControl, IMMUTABLE_CACHE);

      const contentLength = upstream.headers.get(HttpHeader.ContentLength);

      if (contentLength !== null && /^\d+$/u.test(contentLength)) {
        headers.set(HttpHeader.ContentLength, contentLength);
      }

      return new Response(upstream.body, { headers });
    } catch {
      return new Response(null, { status: HttpStatusCode.BadGateway, headers });
    }
  };
}

type UpstreamMethodInput = { readonly request: Request; readonly route: ReleaseRoute };

function upstreamMethod({ request, route }: UpstreamMethodInput): string {
  if (route.isManifest) {
    return HttpMethod.Get;
  }

  return request.method;
}
