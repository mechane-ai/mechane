import { StepSubject } from '@mechane/program';
import { releaseFiles } from '@mechane/release';
import type { ReleaseFailed } from '@mechane/release';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CELLD_OBJECT_STORE, StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import { objectStore } from './store/object-store.ts';

/** The segment that starts an R2 object's key in celld's object store, which the bucket's name follows. */
const R2_SEGMENT = 'r2';

type PublishReleaseInput = {
  readonly projectFolder: string;
  readonly bucket: string;
  /** A folder of built releases, each file at its bucket key below it. */
  readonly folder: string;
};

type ObjectKeyInput = { readonly bucket: string; readonly key: string };

/**
 * Publishes built releases into the stack's own bucket in celld's object store while celld serves, as the release
 * program uploads them to R2. Each file below `folder` goes at its key, in the release program's order.
 */
export const publishRelease = Effect.fn('publishRelease')(function* ({
  projectFolder,
  bucket,
  folder,
}: PublishReleaseInput): Effect.fn.Return<void, StackFailed | ReleaseFailed, Scope.Scope> {
  const files = yield* releaseFiles({ folder });
  const store = yield* objectStore({ path: join(projectFolder, ...CELLD_OBJECT_STORE) });

  for (const file of files) {
    const subjects = [StepSubject.cases.Path.make({ path: file.path })];

    const body = yield* Effect.tryPromise({
      try: () => readFile(file.path),
      catch: (cause) => new StackFailed({ step: StackStep.ReadReleaseFile, subjects, reason: String(cause) }),
    });

    yield* store.put({ key: objectKey({ bucket, key: file.key }), body });
  }
}, Effect.scoped);

/** The key under which celld's object store holds an object of a bucket. */
function objectKey({ bucket, key }: ObjectKeyInput): string {
  return `${R2_SEGMENT}/${bucket}/${key}`;
}
