import { SandboxArchive } from '@mechane/protocol';
import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { DateTime, Option, Schema } from 'effect';
import type { GuestConnection, MachineIdInput, WorkspaceTransferInput } from '../types.ts';
import { copySnapshotPart } from './copy-snapshot-part.ts';
import { workspaceRequest } from './workspace-request.ts';

type RestoreWorkspaceInput = WorkspaceTransferInput & {
  readonly guest: GuestConnection;
  readonly machineId: MachineIdInput['machineId'];
};

/** Resumes a committed snapshot transfer and verifies its archive before the machine becomes ready. */
export async function restoreWorkspace({
  store,
  provider,
  workspace,
  guest,
  machineId,
}: RestoreWorkspaceInput): Promise<boolean> {
  const state = store.workspace();

  if (Option.isNone(state.head)) {
    return true;
  }

  const snapshot = state.head.value;
  const { generation, archive } = snapshot;
  const restored = state.restoration;

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

type ActivateSnapshotInput = Pick<RestoreWorkspaceInput, 'guest' | 'machineId'> & {
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
