import { SandboxMaintenanceFailed } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { open, unlink } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';

type OpenArchiveFileInput = { readonly path: string };
type CloseArchiveFileInput = OpenArchiveFileInput & { readonly handle: FileHandle };
const PRIVATE_FILE_MODE = 0o600;

/** The scope closes and removes only the exclusive temporary file it successfully opened. */
export const openArchiveFile = Effect.fn('openArchiveFile')(function* ({
  path,
}: OpenArchiveFileInput): Effect.fn.Return<FileHandle, SandboxMaintenanceFailed, Scope.Scope> {
  const acquire = Effect.tryPromise({
    try: () => open(path, 'wx', PRIVATE_FILE_MODE),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not create private archive file' }),
  });

  const release: (handle: FileHandle) => Effect.Effect<void> = (handle) => {
    const closed = closeArchiveFile({ handle, path });

    return Effect.orDie(closed);
  };

  return yield* Effect.acquireRelease(acquire, release);
});

const closeArchiveFile = Effect.fn('closeArchiveFile')(function* ({
  path,
  handle,
}: CloseArchiveFileInput): Effect.fn.Return<void, SandboxMaintenanceFailed> {
  const close = Effect.tryPromise({
    try: () => handle.close(),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not close archive file' }),
  });

  const closed = yield* Effect.exit(close);

  yield* Effect.tryPromise({
    try: () => unlink(path),
    catch: () => new SandboxMaintenanceFailed({ reason: 'could not remove temporary archive file' }),
  });

  return yield* closed;
});
