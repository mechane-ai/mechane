import { ReleaseFileNotFound, ReleaseSourceUnavailable } from '@mechane/protocol';
import type { ReleaseFailure } from '@mechane/protocol';
import { HttpHeader, HttpStatusCode } from '@mechane/records';
import { Duration, Effect, Option } from 'effect';
import type { ReleaseFile } from '../types.ts';
import { findReleaseAsset } from './find-release-asset.ts';
import { releaseAssetUrl } from './release-asset-url.ts';

type ServeHostedReleaseFileInput = { readonly origin: URL; readonly key: string; readonly file: ReleaseFile };
type RequestReleaseFileInput = { readonly url: URL; readonly key: string };

const RELEASE_HEADER_WAIT = Duration.seconds(30);

/** Proxies an allowlisted artifact without forwarding provider headers or failure bodies to clients. */
export const serveHostedReleaseFile = Effect.fn('serveHostedReleaseFile')(function* ({
  origin,
  key,
  file,
}: ServeHostedReleaseFileInput): Effect.fn.Return<Response, ReleaseFailure> {
  const asset = findReleaseAsset({ key });

  if (Option.isNone(asset)) {
    return yield* new ReleaseFileNotFound({ key });
  }

  const url = releaseAssetUrl({ origin, ...asset.value });
  const response = yield* requestReleaseFile({ url, key });

  if (!response.ok) {
    const body = Option.fromNullishOr(response.body);

    if (Option.isSome(body)) {
      yield* Effect.tryPromise({
        try: () => body.value.cancel(),
        catch: () => new ReleaseSourceUnavailable({ key, reason: 'release source response could not be closed' }),
      });
    }

    if (response.status === HttpStatusCode.NotFound) {
      return yield* new ReleaseFileNotFound({ key });
    }

    return yield* new ReleaseSourceUnavailable({ key, reason: 'release source rejected the download' });
  }

  const headers = new Headers({
    [HttpHeader.ContentType]: file.contentType,
    [HttpHeader.CacheControl]: file.cacheControl,
  });

  return new Response(response.body, { headers });
});

const requestReleaseFile = Effect.fn('requestReleaseFile')(function* ({
  url,
  key,
}: RequestReleaseFileInput): Effect.fn.Return<Response, ReleaseSourceUnavailable> {
  const unavailable = new ReleaseSourceUnavailable({
    key,
    reason: 'release source did not answer before the deadline',
  });

  return yield* Effect.tryPromise({
    try: (signal) => fetch(url, { signal }),
    catch: () => new ReleaseSourceUnavailable({ key, reason: 'release source could not be reached' }),
  }).pipe(Effect.timeoutOrElse({ duration: RELEASE_HEADER_WAIT, orElse: () => Effect.fail(unavailable) }));
});
