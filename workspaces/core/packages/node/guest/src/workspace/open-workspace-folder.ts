import { Effect } from 'effect';
import type { Scope } from 'effect';
import { mkdtemp, rm } from 'node:fs/promises';
import { GuestMisconfigured } from '../errors.ts';
import { workspaceScratchPath } from './workspace-scratch-path.ts';

/** Keeps archive scratch files outside the workspace home and removes them when the guest scope ends. */
export const openWorkspaceFolder = Effect.fn('openWorkspaceFolder')(function* (): Effect.fn.Return<
  string,
  GuestMisconfigured,
  Scope.Scope
> {
  const prefix = workspaceScratchPath();

  const opening = Effect.tryPromise({
    try: () => mkdtemp(prefix),
    catch: (cause) => new GuestMisconfigured({ reason: String(cause) }),
  });

  const release: (folder: string) => Effect.Effect<void> = (folder) => {
    const removal = Effect.tryPromise({
      try: () => rm(folder, { recursive: true, force: true }),
      catch: (cause) => new GuestMisconfigured({ reason: String(cause) }),
    });

    return removal.pipe(Effect.orDie);
  };

  return yield* Effect.acquireRelease(opening, release);
});
