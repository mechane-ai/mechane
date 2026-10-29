import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import type { SandboxArchive } from '@mechane/protocol';
import { Effect } from 'effect';
import type { Hash } from 'node:crypto';
import { link } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';

type PublishArchiveInput = {
  readonly handle: FileHandle;
  readonly hash: Hash;
  readonly archive: SandboxArchive;
  readonly temporary: string;
  readonly destination: string;
};

/** Verification and fsync precede the exclusive link that publishes the completed archive. */
export const publishArchive = Effect.fn('publishArchive')(function* ({
  handle,
  hash,
  archive,
  temporary,
  destination,
}: PublishArchiveInput): Effect.fn.Return<void, SandboxMaintenanceFailed> {
  const stat = yield* Effect.tryPromise({
    try: () => handle.stat(),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not read archive size' }),
  });

  const digest = hash.digest('hex');

  if (stat.size !== archive.bytes || digest !== archive.sha256) {
    return yield* new SandboxMaintenanceFailed({
      reason: 'archive size or SHA-256 does not match the server manifest',
    });
  }

  yield* Effect.tryPromise({
    try: () => handle.sync(),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not flush archive file' }),
  });

  const publishFailure = `could not publish archive at ${destination}; destination must not exist`;

  yield* Effect.tryPromise({
    try: () => link(temporary, destination),
    catch: () => new SandboxMaintenanceFailed({ reason: publishFailure }),
  });
});
