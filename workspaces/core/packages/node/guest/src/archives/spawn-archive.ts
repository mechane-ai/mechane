import { Deferred, Effect } from 'effect';
import { spawn } from 'node:child_process';
import type { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import { observeArchiveProcess } from './observe-archive-process.ts';
import type { ArchiveProcess } from './types.ts';

/** Starts tar with a clean environment and retains its completion and bounded error output. */
export const spawnArchive = Effect.fn('spawnArchive')(function* ({
  generation,
  settings,
}: WorkspaceFilesInput): Effect.fn.Return<ArchiveProcess, WorkspaceFailed> {
  return yield* Effect.callback<ArchiveProcess, WorkspaceFailed>((resume) => {
    const exited = Deferred.makeUnsafe<void, WorkspaceFailed>();

    const child = spawn('tar', ['-cf', '-', '-C', settings.home, '.'], {
      env: { PATH: settings.path },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    observeArchiveProcess({ generation, child, exited, resume });
  });
});
