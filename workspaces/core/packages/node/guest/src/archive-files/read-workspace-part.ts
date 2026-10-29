import type { RecordId } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { WorkspaceFailed } from '../errors.ts';
import { workspaceFilePath } from '../workspace/workspace-file-path.ts';
import { archivePartName } from './archive-part-name.ts';
import { openWorkspaceFile } from './open-workspace-file.ts';
import { readFilePart } from './read-file-part.ts';

type ReadWorkspacePartInput = { readonly generation: RecordId; readonly part: number; readonly folder: string };

/** Reads a part only when its complete file fits the protocol byte limit. */
export const readWorkspacePart = Effect.fn('readWorkspacePart')(function* ({
  generation,
  folder,
  part,
}: ReadWorkspacePartInput): Effect.fn.Return<Uint8Array, WorkspaceFailed, Scope.Scope> {
  const name = archivePartName({ part });
  const path = workspaceFilePath({ folder, generation, file: name });
  const file = yield* openWorkspaceFile({ path, generation, step: WorkspaceStep.Part, mode: 'r' });
  const body = yield* readFilePart({ file, generation });
  const probe = new Uint8Array(1);

  const extra = yield* Effect.tryPromise({
    try: () => file.read(probe),
    catch: (cause) => new WorkspaceFailed({ generation, step: WorkspaceStep.Part, reason: String(cause) }),
  });

  if (extra.bytesRead > 0) {
    return yield* new WorkspaceFailed({
      generation,
      step: WorkspaceStep.Part,
      reason: 'archive part exceeds its byte limit',
    });
  }

  return body;
}, Effect.scoped);
