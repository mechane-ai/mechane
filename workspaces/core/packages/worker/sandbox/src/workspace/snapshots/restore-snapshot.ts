import { SandboxArchive } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { WorkspaceSnapshot } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { DateTime, Option, Schema } from 'effect';
import type { GuestConnection, MachineIdInput, WorkspaceTransferInput } from '../../types.ts';
import { workspaceRequest } from '../workspace-request.ts';
import { copySnapshotPart } from './copy-snapshot-part.ts';

type RestoreSnapshotInput = WorkspaceTransferInput &
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
    const startedAt = DateTime.nowUnsafe();

    store.saveRestoration({ machineId, generation, part: 0, startedAt });

    return false;
  }

  const { part } = restored.value;

  if (part < archive.parts) {
    await copySnapshotPart({ store, provider, workspace, guest, snapshot, restoration: restored.value });

    return false;
  }

  return await activateSnapshot({ guest, machineId, generation, archive });
}

type ActivateSnapshotInput = Pick<RestoreSnapshotInput, 'guest' | 'machineId'> & {
  readonly generation: string;
  readonly archive: SandboxArchive;
};

async function activateSnapshot({ guest, machineId, generation, archive }: ActivateSnapshotInput): Promise<boolean> {
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

  return response.status === HttpStatusCode.Ok;
}
