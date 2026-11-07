import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import {
  ArchiveMode,
  SANDBOX_ARCHIVE_PART_BYTES,
  SandboxAction,
  SandboxArchive,
  WORKSPACE_ARCHIVE_MAX_BYTES,
  WorkspaceArchiveRequest,
  WorkspaceStep,
} from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import { WorkspaceTransferFailed } from '../errors.ts';
import type { GuestConnection } from '../types.ts';
import { workspaceRequest } from '../workspace/workspace-request.ts';
import { checkpointSupported } from './checkpoint-supported.ts';
import type { CheckpointStepInput } from './types.ts';

type ArchiveCheckpointInput = CheckpointStepInput & { readonly guest: GuestConnection };

/** Polls the guest archive job and persists its validated metadata before transferring parts. */
export async function archiveCheckpoint({ store, checkpoint, guest }: ArchiveCheckpointInput): Promise<void> {
  const { generation, machineId } = checkpoint;
  const part = Option.none();

  const mode = archiveMode({ store, checkpoint });

  const codec = Schema.fromJsonString(WorkspaceArchiveRequest);
  const body = Schema.encodeSync(codec)({ mode });
  const isCheckpointSupported = await checkpointSupported({ guest, machineId, generation });

  const step: WorkspaceStep = (() => {
    if (isCheckpointSupported) {
      return WorkspaceStep.Checkpoint;
    }

    return WorkspaceStep.Archive;
  })();

  const init: RequestInit = (() => {
    if (isCheckpointSupported) {
      return { method: HttpMethod.Put, headers: { [HttpHeader.ContentType]: MediaType.Json }, body };
    }

    return { method: HttpMethod.Put };
  })();

  const response = await workspaceRequest({ guest, machineId, generation, step, part, init });

  if (response.status === HttpStatusCode.NoContent) {
    return;
  }

  const text = await response.text();
  const archive = decodeCheckpointArchive({ generation, body: text });

  const storedArchive = Option.some(archive);

  store.saveCheckpoint({ ...checkpoint, archive: storedArchive });
}

type ArchiveModeInput = Pick<ArchiveCheckpointInput, 'store' | 'checkpoint'>;

function archiveMode({ store, checkpoint }: ArchiveModeInput): ArchiveMode {
  if ('executionId' in checkpoint) {
    return ArchiveMode.Snapshot;
  }

  const purpose = checkpoint.purpose;

  if (FileCheckpointPurpose.guards.Drain(purpose)) {
    return ArchiveMode.Drain;
  }

  const maintenance = store.portableMaintenance();
  const isUpgrade = Option.isSome(maintenance) && maintenance.value.action === SandboxAction.Upgrade;

  if (isUpgrade) {
    return ArchiveMode.Drain;
  }

  return ArchiveMode.Snapshot;
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
