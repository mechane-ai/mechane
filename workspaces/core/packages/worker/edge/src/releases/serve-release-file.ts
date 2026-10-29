import type { WorkerSettings } from '@mechane/bindings';
import { ReleaseFileNotFound, ReleasesBucketUnavailable } from '@mechane/protocol';
import type { ReleaseFailure } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import type { MediaType } from '@mechane/records';
import { Effect, Option } from 'effect';

/** How one kind of release file is served: its media type and how long a client may keep it. */
type ReleaseFile = { readonly contentType: MediaType; readonly cacheControl: string };

type ServeReleaseFileInput = { readonly settings: WorkerSettings; readonly key: string; readonly file: ReleaseFile };

/**
 * Answers with the release file at `key`, as its bucket holds it. The body streams through a stream of the object's
 * size, so the answer carries that size as its length, which a runtime drops from a plain stream.
 */
export const serveReleaseFile = Effect.fn('serveReleaseFile')(function* ({
  settings,
  key,
  file,
}: ServeReleaseFileInput): Effect.fn.Return<Response, ReleaseFailure> {
  const stored = yield* Effect.tryPromise({
    try: () => settings.releases.get(key),
    catch: (cause) => new ReleasesBucketUnavailable({ key, reason: String(cause) }),
  });

  const object = Option.fromNullishOr(stored);

  if (Option.isNone(object)) {
    return yield* new ReleaseFileNotFound({ key });
  }

  const { body, size, httpEtag } = object.value;

  const headers = {
    [HttpHeader.ContentType]: file.contentType,
    [HttpHeader.CacheControl]: file.cacheControl,
    [HttpHeader.ETag]: httpEtag,
  };

  return new Response(body.pipeThrough(new FixedLengthStream(size)), { headers });
});
