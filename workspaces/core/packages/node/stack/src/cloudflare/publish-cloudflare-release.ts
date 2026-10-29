import { releaseFiles } from '@mechane/release';
import type { ReleaseFailed } from '@mechane/release';
import { Effect } from 'effect';
import type { Miniflare } from 'miniflare';
import { readFile } from 'node:fs/promises';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';

type PublishCloudflareReleaseInput = { readonly runtime: Miniflare; readonly folder: string };

/** Publishes normal release files into the local workerd R2 binding. */
export const publishCloudflareRelease = Effect.fn('publishCloudflareRelease')(function* ({
  runtime,
  folder,
}: PublishCloudflareReleaseInput): Effect.fn.Return<void, StackFailed | ReleaseFailed> {
  const files = yield* releaseFiles({ folder });

  const bucket = yield* Effect.tryPromise({
    try: () => runtime.getR2Bucket('RELEASES'),
    catch: (cause) => new StackFailed({ step: StackStep.PutReleaseFile, reason: String(cause) }),
  });

  for (const file of files) {
    const contents = yield* Effect.tryPromise({
      try: () => readFile(file.path),
      catch: (cause) => new StackFailed({ step: StackStep.PutReleaseFile, reason: String(cause) }),
    });

    yield* Effect.tryPromise({
      try: () => bucket.put(file.key, contents),
      catch: (cause) => new StackFailed({ step: StackStep.PutReleaseFile, reason: String(cause) }),
    });
  }
});
