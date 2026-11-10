import { Effect } from 'effect';
import type { Scope } from 'effect';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { DistributionStep } from '../constants.ts';
import { DistributionFailed } from '../errors.ts';
import type { FileDigest } from '../types.ts';
import { openArchiveEntry } from './open-archive-entry.ts';
import type { ArchiveEntryInput, ArchiveProcess } from './types.ts';

type ReadEntryInput = { readonly child: ArchiveProcess; readonly signal: AbortSignal };

/** Binary assets must be hashed before text decoding or archive extraction. */
export const archiveEntryDigest = Effect.fn('archiveEntryDigest')(function* ({
  path,
  entry,
  settings,
  format,
}: ArchiveEntryInput): Effect.fn.Return<FileDigest, DistributionFailed, Scope.Scope> {
  const child = yield* openArchiveEntry({ path, entry, settings, format });

  const measured = yield* Effect.tryPromise({
    try: (signal) => hashArchiveEntry({ child, signal }),
    catch: () =>
      new DistributionFailed({ step: DistributionStep.Verify, reason: 'artifact archive entry could not be read' }),
  });

  if (child.exitCode !== 0) {
    return yield* new DistributionFailed({
      step: DistributionStep.Verify,
      reason: 'artifact archive entry extraction failed',
    });
  }

  return measured;
}, Effect.scoped);

async function hashArchiveEntry({ child, signal }: ReadEntryInput): Promise<FileDigest> {
  const hash = createHash('sha256');
  const progress = { bytes: 0 };

  const countBytes: (chunk: Buffer) => void = (chunk) => {
    progress.bytes += chunk.byteLength;
  };

  child.stdout.on('data', countBytes);

  const copied = pipeline(child.stdout, hash, { signal });
  const exited = once(child, 'close');

  await Promise.all([copied, exited]);

  return { sha256: hash.digest('hex'), bytes: progress.bytes };
}
