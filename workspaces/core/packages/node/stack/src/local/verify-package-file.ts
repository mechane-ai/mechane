import { Effect } from 'effect';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { StackStep } from '../constants.ts';
import { StackFailed } from '../errors.ts';
import type { LocalPackage } from './schemas.ts';

type VerifyPackageFileInput = { readonly path: string; readonly expected: LocalPackage['files']['celld'] };

/** Rejects missing, replaced, or altered release files before any runtime process starts. */
export const verifyPackageFile = Effect.fn('verifyPackageFile')(function* ({
  path,
  expected,
}: VerifyPackageFileInput): Effect.fn.Return<void, StackFailed> {
  const status = yield* Effect.tryPromise({
    try: () => lstat(path),
    catch: (cause) => new StackFailed({ step: StackStep.VerifyLocalPackage, reason: String(cause) }),
  });

  if (!status.isFile() || status.size !== expected.bytes) {
    return yield* new StackFailed({ step: StackStep.VerifyLocalPackage, reason: `${path} differs from its manifest` });
  }

  const sha256 = yield* Effect.tryPromise({
    try: (signal) => hashPackageFile({ path, signal }),
    catch: (cause) => new StackFailed({ step: StackStep.VerifyLocalPackage, reason: String(cause) }),
  });

  if (sha256 !== expected.sha256) {
    return yield* new StackFailed({ step: StackStep.VerifyLocalPackage, reason: `${path} differs from its manifest` });
  }
});

type HashPackageFileInput = { readonly path: string; readonly signal: AbortSignal };

async function hashPackageFile({ path, signal }: HashPackageFileInput): Promise<string> {
  const hash = createHash('sha256');
  const source = createReadStream(path);

  await pipeline(source, hash, { signal });

  return hash.digest('hex');
}
