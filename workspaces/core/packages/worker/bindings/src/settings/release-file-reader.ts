import { WorkerMisconfigured } from '@mechane/protocol';
import { Effect, Option } from 'effect';
import { serveBucketReleaseFile } from '../releases/serve-bucket-release-file.ts';
import { serveHostedReleaseFile } from '../releases/serve-hosted-release-file.ts';
import type { ReleaseFileReader } from '../types.ts';

type ReleaseFileReaderInput = {
  /** Absent when the releases bucket supplies downloads. */
  readonly origin: Option.Option<URL>;
  /** Absent when downloads use the configured public artifact source. */
  readonly bucket: Option.Option<R2Bucket>;
};

/** Refuses installations that provide neither a public artifact source nor a releases bucket. */
export const releaseFileReader = Effect.fn('releaseFileReader')(function* ({
  origin,
  bucket,
}: ReleaseFileReaderInput): Effect.fn.Return<ReleaseFileReader, WorkerMisconfigured> {
  if (Option.isSome(origin)) {
    const readHosted: ReleaseFileReader = ({ key, file }) =>
      serveHostedReleaseFile({ origin: origin.value, key, file });

    return readHosted;
  }

  if (Option.isNone(bucket)) {
    return yield* new WorkerMisconfigured({ reason: 'configure a release origin or bind the releases bucket' });
  }

  const readBucket: ReleaseFileReader = ({ key, file }) => serveBucketReleaseFile({ bucket: bucket.value, key, file });

  return readBucket;
});
