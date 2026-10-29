import { finishedProcess } from '@mechane/program';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceRestoreInput } from '../types.ts';
import { WORKSPACE_TRANSFER_TIMEOUT } from './constants.ts';
import { joinArchive } from './join-archive.ts';

/** Only a verified archive may replace the new machine's home, before the machine becomes ready. */
export const restoreWorkspace = Effect.fn('restoreWorkspace')(function* (
  input: WorkspaceRestoreInput,
): Effect.fn.Return<void, WorkspaceFailed> {
  const { generation, settings } = input;
  const archive = yield* joinArchive(input);

  const files = yield* Effect.tryPromise({
    try: () => readdir(settings.home),
    catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Restore, reason: String(cause) }),
  });

  for (const file of files) {
    const path = join(settings.home, file);

    yield* Effect.tryPromise({
      try: () => rm(path, { recursive: true, force: true }),
      catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Restore, reason: String(cause) }),
    });
  }

  yield* finishedProcess({
    command: 'tar',
    args: ['-xzf', archive, '-C', settings.home],
    environment: { PATH: settings.path },
    timeout: WORKSPACE_TRANSFER_TIMEOUT,
  }).pipe(
    Effect.mapError(
      (failure) => new WorkspaceFailed({ generation, step: WorkspaceStep.Restore, reason: failure.reason }),
    ),
  );
});
