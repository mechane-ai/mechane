import type { SandboxArchive } from '@mechane/protocol';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import { mkdir } from 'node:fs/promises';
import { WorkspaceFailed } from '../errors.ts';
import { quiesceWorkspace } from '../quiescence/quiesce-workspace.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import { workspaceFilePath } from '../workspace/workspace-file-path.ts';
import { splitArchive } from './split-archive.ts';
import { writeWorkspaceArchive } from './write-workspace-archive.ts';

/** Quiesces the workspace, creates a bounded archive and prepares independently transferable parts. */
export const archiveWorkspace = Effect.fn('archiveWorkspace')(function* (
  input: WorkspaceFilesInput,
): Effect.fn.Return<SandboxArchive, WorkspaceFailed> {
  const { generation, folder } = input;
  const directory = workspaceFilePath({ folder, generation, file: '' });

  yield* quiesceWorkspace(input);
  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true }),
    catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: String(cause) }),
  });
  yield* writeWorkspaceArchive(input);

  return yield* splitArchive(input);
});
