import { Effect } from 'effect';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { FileDigest, PathInput } from '../types.ts';

/** Hashes regular artifact files as a stream, rejecting symlinks before publication. */
export const fileDigest = Effect.fn('fileDigest')(function* ({
  path,
}: PathInput): Effect.fn.Return<FileDigest, DistributionFailed> {
  const status = yield* Effect.tryPromise({
    try: () => lstat(path),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  if (!status.isFile() || status.isSymbolicLink()) {
    return yield* new DistributionFailed({ step: DistributionStep.Read, reason: 'artifact must be a regular file' });
  }

  const sha256 = yield* Effect.tryPromise({
    try: () => hashFile({ path }),
    catch: (cause) => new DistributionFailed({ step: DistributionStep.Read, reason: String(cause) }),
  });

  return { sha256, bytes: status.size } satisfies FileDigest;
});

async function hashFile({ path }: PathInput): Promise<string> {
  const hash = createHash('sha256');

  const source = createReadStream(path);

  await pipeline(source, hash);

  return hash.digest('hex');
}
