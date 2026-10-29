import type { SandboxArchive } from '@mechane/protocol';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { archivePartName } from '../archive-files/archive-part-name.ts';
import { openWorkspaceFile } from '../archive-files/open-workspace-file.ts';
import { readFilePart } from '../archive-files/read-file-part.ts';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceFilesInput } from '../types.ts';
import { workspaceFilePath } from '../workspace/workspace-file-path.ts';
import { ARCHIVE_FILE } from './constants.ts';

/** Splits a completed archive into protocol-sized files and calculates its complete checksum. */
export const splitArchive = Effect.fn('splitArchive')(function* ({
  folder,
  generation,
}: WorkspaceFilesInput): Effect.fn.Return<SandboxArchive, WorkspaceFailed, Scope.Scope> {
  const path = workspaceFilePath({ folder, generation, file: ARCHIVE_FILE });
  const file = yield* openWorkspaceFile({ path, generation, step: WorkspaceStep.Archive, mode: 'r' });
  const hash = createHash('sha256');
  const state = { bytes: 0, parts: 0 };

  for (
    let body = yield* readFilePart({ file, generation });
    body.byteLength > 0;
    body = yield* readFilePart({ file, generation })
  ) {
    const name = archivePartName({ part: state.parts });
    const part = workspaceFilePath({ folder, generation, file: name });

    yield* Effect.tryPromise({
      try: () => writeFile(part, body),
      catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Archive, reason: String(cause) }),
    });

    hash.update(body);

    state.bytes += body.byteLength;
    state.parts += 1;
  }

  return { ...state, sha256: hash.digest('hex') };
}, Effect.scoped);
