import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { WorkspaceRestoration, WorkspaceSnapshot } from '@mechane/sandbox-store';
import { SandboxArchive, WorkspaceStep } from '@mechane/sandbox-wire';
import { Array, DateTime, Option, Schema } from 'effect';
import { WORKSPACE_TRANSFER_BATCH_DURATION, WORKSPACE_TRANSFER_BATCH_PARTS } from '../../constants.ts';
import type { GuestConnection, MachineIdInput, WorkspaceProviderStepInput } from '../../types.ts';
import { verifyGenerationManifest } from '../generation-manifest.ts';
import { workspaceRequest } from '../workspace-request.ts';
import { copySnapshotPart } from './copy-snapshot-part.ts';
import { isCurrentRestoration } from './current-restoration.ts';

type RestoreSnapshotInput = WorkspaceProviderStepInput &
  MachineIdInput & { readonly guest: GuestConnection; readonly snapshot: WorkspaceSnapshot };

/** An imported candidate must pass the same bounded guest verification as a committed snapshot. */
export async function restoreSnapshot({
  store,
  provider,
  workspace,
  guest,
  machineId,
  snapshot,
}: RestoreSnapshotInput): Promise<boolean> {
  const { generation, archive } = snapshot;
  const restored = store.workspace().restoration;

  if (Option.isNone(restored) || restored.value.machineId !== machineId || restored.value.generation !== generation) {
    await verifyGenerationManifest({ workspace, snapshot });

    const startedAt = DateTime.nowUnsafe();

    store.saveRestoration({ machineId, generation, part: 0, startedAt });

    return false;
  }

  const startedAt = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(startedAt, WORKSPACE_TRANSFER_BATCH_DURATION);
  const partLimit = Math.min(restored.value.part + WORKSPACE_TRANSFER_BATCH_PARTS, archive.parts);
  const parts = Array.range(restored.value.part, partLimit);

  for (const part of parts) {
    const current = store.workspace().restoration;

    if (Option.isNone(current) || current.value.machineId !== machineId || current.value.generation !== generation) {
      return false;
    }

    if (current.value.part !== part) {
      return false;
    }

    if (part === archive.parts) {
      return await activateSnapshot({ store, guest, restoration: current.value, archive });
    }

    const now = DateTime.nowUnsafe();

    if (part === partLimit || DateTime.isGreaterThanOrEqualTo(now, deadline)) {
      return false;
    }

    await copySnapshotPart({ store, provider, workspace, guest, snapshot, restoration: current.value });
  }

  return false;
}

type ActivateSnapshotInput = Pick<RestoreSnapshotInput, 'store' | 'guest'> & {
  readonly restoration: WorkspaceRestoration;
  readonly archive: SandboxArchive;
};

async function activateSnapshot({ store, guest, restoration, archive }: ActivateSnapshotInput): Promise<boolean> {
  const { machineId, generation } = restoration;
  const schema = Schema.toType(SandboxArchive);
  const codec = Schema.fromJsonString(schema);
  const body = Schema.encodeSync(codec)(archive);
  const part = Option.none();

  const response = await workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Restore,
    part,
    init: { method: HttpMethod.Put, headers: { [HttpHeader.ContentType]: MediaType.Json }, body },
  });

  return response.status === HttpStatusCode.Ok && isCurrentRestoration({ store, restoration });
}
