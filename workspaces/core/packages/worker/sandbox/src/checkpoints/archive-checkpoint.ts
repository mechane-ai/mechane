import { SANDBOX_ARCHIVE_PART_BYTES, SandboxArchive } from '@mechane/protocol';
import { HttpMethod, HttpStatusCode } from '@mechane/records';
import { WORKSPACE_ARCHIVE_MAX_BYTES, WorkspaceStep } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { WorkspaceTransferFailed } from '../errors.ts';
import type { GuestConnection } from '../types.ts';
import { workspaceRequest } from '../workspace/workspace-request.ts';
import type { CheckpointStepInput } from './types.ts';

type ArchiveCheckpointInput = CheckpointStepInput & { readonly guest: GuestConnection };

/** Polls the guest archive job and persists its validated metadata before transferring parts. */
export async function archiveCheckpoint({ store, checkpoint, guest }: ArchiveCheckpointInput): Promise<void> {
  const { generation, machineId } = checkpoint;
  const part = Option.none();

  const response = await workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Archive,
    part,
    init: { method: HttpMethod.Put },
  });

  if (response.status === HttpStatusCode.NoContent) {
    return;
  }

  const body = await response.text();
  const archive = decodeCheckpointArchive({ generation, body });

  const storedArchive = Option.some(archive);

  store.saveCheckpoint({ ...checkpoint, archive: storedArchive });
}

type DecodeCheckpointArchiveInput = { readonly generation: string; readonly body: string };

function decodeCheckpointArchive({ generation, body }: DecodeCheckpointArchiveInput): SandboxArchive {
  const schema = Schema.toType(SandboxArchive);
  const codec = Schema.fromJsonString(schema);
  const decoded = Schema.decodeUnknownResult(codec)(body);

  const checked = Result.mapError(
    decoded,
    (failure) => new WorkspaceTransferFailed({ generation, step: WorkspaceStep.Archive, reason: failure.message }),
  );

  const archive = Result.getOrThrow(checked);

  if (
    archive.bytes === 0 ||
    archive.bytes > WORKSPACE_ARCHIVE_MAX_BYTES ||
    archive.parts !== Math.ceil(archive.bytes / SANDBOX_ARCHIVE_PART_BYTES)
  ) {
    const cause = new WorkspaceTransferFailed({
      generation,
      step: WorkspaceStep.Archive,
      reason: 'archive metadata has an invalid part count',
    });

    const failure = Result.fail(cause);

    Result.getOrThrow(failure);
  }

  return archive;
}
