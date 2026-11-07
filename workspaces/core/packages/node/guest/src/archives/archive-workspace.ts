import type { SandboxArchive } from '@mechane/sandbox-wire';
import { ArchiveMode, WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { mkdir } from 'node:fs/promises';
import { WorkspaceFailed } from '../errors.ts';
import { freezeWorkspace } from '../quiescence/freeze-workspace.ts';
import type { FreezeInput, FreezeLease } from '../quiescence/freeze.types.ts';
import { workspaceFilePath } from '../workspace/workspace-file-path.ts';
import { splitArchive } from './split-archive.ts';
import { writeWorkspaceArchive } from './write-workspace-archive.ts';

export type ArchiveWorkspaceInput = FreezeInput & {
  readonly archiveMode: ArchiveMode;
  readonly retainFreeze: (lease: FreezeLease) => void;
};

/** Snapshot writers resume after the stable local copy; a successful drain retains its lease until release. */
export const archiveWorkspace = Effect.fn('archiveWorkspace')(function* (
  input: ArchiveWorkspaceInput,
): Effect.fn.Return<SandboxArchive, WorkspaceFailed, Scope.Scope> {
  const { generation, folder } = input;
  const directory = workspaceFilePath({ folder, generation, file: '' });

  yield* Effect.tryPromise({
    try: () => mkdir(directory, { recursive: true }),
    catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: String(cause) }),
  });

  const lease = yield* freezeWorkspace(input);

  yield* writeWorkspaceArchive(input);

  const archive = yield* splitArchive(input);

  if (input.archiveMode === ArchiveMode.Drain) {
    lease.retain();
    input.retainFreeze(lease);
  }

  return archive;
}, Effect.scoped);
