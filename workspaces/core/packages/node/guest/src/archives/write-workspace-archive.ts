import { Deferred, Effect } from 'effect';
import type { Scope } from 'effect';
import type { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import { compressWorkspaceArchive } from './compress-workspace-archive.ts';
import { spawnArchive } from './spawn-archive.ts';
import { stopArchive } from './stop-archive.ts';

/** Both the plain tar stream and its compressed representation have fixed limits before they reach disk. */
export const writeWorkspaceArchive = Effect.fn('writeWorkspaceArchive')(function* (
  input: WorkspaceFilesInput,
): Effect.fn.Return<void, WorkspaceFailed, Scope.Scope> {
  const starting = spawnArchive(input);
  const { child, exited } = yield* Effect.acquireRelease(starting, stopArchive);

  yield* compressWorkspaceArchive({ ...input, child });
  yield* Deferred.await(exited);
}, Effect.scoped);
