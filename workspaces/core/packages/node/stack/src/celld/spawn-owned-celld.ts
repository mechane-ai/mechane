import { Effect } from 'effect';
import type { Scope } from 'effect';
import type { ChildProcess } from 'node:child_process';
import type { StackFailed } from '../errors.ts';
import { removeCelldOwner } from './remove-celld-owner.ts';
import { spawnCelld } from './spawn-celld.ts';
import { writeCelldOwner } from './write-celld-owner.ts';

type SpawnOwnedCelldInput = Parameters<typeof spawnCelld>[0] & { readonly isPersistent: boolean };

/** Marks persistent startup before launching celld so an interrupted launch cannot silently release its state. */
export const spawnOwnedCelld = Effect.fn('spawnOwnedCelld')(function* ({
  isPersistent,
  ...input
}: SpawnOwnedCelldInput): Effect.fn.Return<ChildProcess, StackFailed, Scope.Scope> {
  if (!isPersistent) {
    return yield* spawnCelld(input);
  }

  yield* writeCelldOwner({ projectFolder: input.projectFolder, owner: { processGroups: [], isReady: false } });

  const cleanup = removeCelldOwner({ projectFolder: input.projectFolder });
  const onError: () => Effect.Effect<void> = () => cleanup;

  return yield* spawnCelld(input).pipe(Effect.onError(onError));
});
