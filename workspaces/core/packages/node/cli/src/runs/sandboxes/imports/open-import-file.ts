import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';

type OpenImportFileInput = { readonly file: string };
type CloseImportFileInput = { readonly handle: FileHandle };

/** The import scope owns the read handle and closes it on interruption. */
export const openImportFile = Effect.fn('openImportFile')(function* ({
  file,
}: OpenImportFileInput): Effect.fn.Return<FileHandle, SandboxMaintenanceFailed, Scope.Scope> {
  const acquire = Effect.tryPromise({
    try: () => open(file, 'r'),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not open import archive' }),
  });

  const release: (handle: FileHandle) => Effect.Effect<void> = (handle) => {
    const closed = closeImportFile({ handle });

    return Effect.orDie(closed);
  };

  return yield* Effect.acquireRelease(acquire, release);
});

const closeImportFile = Effect.fn('closeImportFile')(function* ({
  handle,
}: CloseImportFileInput): Effect.fn.Return<void, SandboxMaintenanceFailed> {
  yield* Effect.tryPromise({
    try: () => handle.close(),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not close import archive' }),
  });
});
