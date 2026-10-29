import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Array, Effect } from 'effect';
import type { Scope } from 'effect';
import { createHash } from 'node:crypto';
import type { Hash } from 'node:crypto';
import type { FileHandle } from 'node:fs/promises';
import { openWorkspaceFile } from '../archive-files/open-workspace-file.ts';
import { validatedWorkspacePart } from '../archive-files/validated-workspace-part.ts';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceRestoreInput } from '../types.ts';
import { workspaceFilePath } from '../workspace/workspace-file-path.ts';
import { ARCHIVE_FILE } from './constants.ts';

/** Joins bounded parts and verifies the complete archive checksum before extraction. */
export const joinArchive = Effect.fn('joinArchive')(function* ({
  folder,
  generation,
  archive,
}: WorkspaceRestoreInput): Effect.fn.Return<string, WorkspaceFailed, Scope.Scope> {
  const path = workspaceFilePath({ folder, generation, file: ARCHIVE_FILE });
  const file = yield* openWorkspaceFile({ path, generation, step: WorkspaceStep.Restore, mode: 'w' });
  const hash = createHash('sha256');

  const parts = Array.range(0, archive.parts - 1);

  const append: (part: number) => Effect.Effect<void, WorkspaceFailed> = (part) =>
    appendArchivePart({ folder, generation, archive, part, file, hash });

  yield* Effect.forEach(parts, append, { concurrency: 1, discard: true });

  if (hash.digest('hex') !== archive.sha256) {
    return yield* new WorkspaceFailed({
      generation,
      step: WorkspaceStep.Restore,
      reason: 'workspace archive checksum does not match',
    });
  }

  return path;
}, Effect.scoped);

type AppendArchivePartInput = Pick<WorkspaceRestoreInput, 'folder' | 'generation' | 'archive'> & {
  readonly part: number;
  readonly file: FileHandle;
  readonly hash: Hash;
};

const appendArchivePart = Effect.fn('appendArchivePart')(function* ({
  folder,
  generation,
  archive,
  part,
  file,
  hash,
}: AppendArchivePartInput): Effect.fn.Return<void, WorkspaceFailed> {
  const body = yield* validatedWorkspacePart({ folder, generation, archive, part });

  yield* Effect.tryPromise({
    try: () => file.writeFile(body),
    catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Restore, reason: String(cause) }),
  });
  hash.update(body);
});
