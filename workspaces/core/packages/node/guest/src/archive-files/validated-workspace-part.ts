import { SANDBOX_ARCHIVE_PART_BYTES } from '@mechane/protocol';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Effect } from 'effect';
import { WorkspaceFailed } from '../errors.ts';
import type { WorkspaceRestoreInput } from '../types.ts';
import { readWorkspacePart } from './read-workspace-part.ts';

type ValidatedWorkspacePartInput = Pick<WorkspaceRestoreInput, 'folder' | 'generation' | 'archive'> & {
  readonly part: number;
};

/** Reads a restore part and checks its exact expected byte count. */
export const validatedWorkspacePart = Effect.fn('validatedWorkspacePart')(function* ({
  folder,
  generation,
  archive,
  part,
}: ValidatedWorkspacePartInput): Effect.fn.Return<Uint8Array, WorkspaceFailed> {
  const body = yield* readWorkspacePart({ folder, generation, part });
  const expected = Math.min(SANDBOX_ARCHIVE_PART_BYTES, archive.bytes - part * SANDBOX_ARCHIVE_PART_BYTES);

  if (body.byteLength !== expected) {
    return yield* new WorkspaceFailed({
      generation,
      step: WorkspaceStep.Restore,
      reason: 'archive part has the wrong byte count',
    });
  }

  return body;
});
