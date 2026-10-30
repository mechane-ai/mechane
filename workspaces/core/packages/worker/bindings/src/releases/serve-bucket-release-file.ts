import { ReleaseFileNotFound, ReleasesBucketUnavailable } from '@mechane/protocol';
import type { ReleaseFailure } from '@mechane/protocol';
import { HttpHeader } from '@mechane/records';
import { Effect, Option } from 'effect';
import type { ReleaseFile } from '../types.ts';

type ServeBucketReleaseFileInput = { readonly bucket: R2Bucket; readonly key: string; readonly file: ReleaseFile };

/** The fixed-length stream keeps the bucket object's size on the response. */
export const serveBucketReleaseFile = Effect.fn('serveBucketReleaseFile')(function* ({
  bucket,
  key,
  file,
}: ServeBucketReleaseFileInput): Effect.fn.Return<Response, ReleaseFailure> {
  const stored = yield* Effect.tryPromise({
    try: () => bucket.get(key),
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

  const length = new FixedLengthStream(size);
  const stream = body.pipeThrough(length);

  return new Response(stream, { headers });
});
