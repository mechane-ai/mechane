import type { RecordId } from '@mechane/records';
import type { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { open } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { WorkspaceFailed } from '../errors.ts';

type OpenWorkspaceFileInput = {
  readonly generation: RecordId;
  readonly step: WorkspaceStep;
  readonly path: string;
  readonly mode: 'r' | 'w';
};

/** Opens an archive file for a scoped transfer and closes it when the transfer ends. */
export const openWorkspaceFile = Effect.fn('openWorkspaceFile')(function* ({
  generation,
  step,
  path,
  mode,
}: OpenWorkspaceFileInput): Effect.fn.Return<FileHandle, WorkspaceFailed, Scope.Scope> {
  const opening = Effect.tryPromise({
    try: () => open(path, mode),
    catch: (cause) => new WorkspaceFailed({ generation, step, reason: String(cause) }),
  });

  const release: (file: FileHandle) => Effect.Effect<void> = (file) => {
    const closing = closeWorkspaceFile({ generation, step, file });

    return closing.pipe(Effect.orDie);
  };

  return yield* Effect.acquireRelease(opening, release);
});

type CloseWorkspaceFileInput = Pick<OpenWorkspaceFileInput, 'generation' | 'step'> & { readonly file: FileHandle };

/** A scoped file belongs to the transfer until its close completes. */
const closeWorkspaceFile = Effect.fn('closeWorkspaceFile')(function* ({
  generation,
  step,
  file,
}: CloseWorkspaceFileInput): Effect.fn.Return<void, WorkspaceFailed> {
  yield* Effect.tryPromise({
    try: () => file.close(),
    catch: (cause) => new WorkspaceFailed({ generation, step, reason: String(cause) }),
  });
});
