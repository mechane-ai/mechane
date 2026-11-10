import { HttpMethod, HttpStatusCode } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { GuestConnection, MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { workspaceRequest } from './workspace-request.ts';

type ReleaseWorkspaceInput = WorkspaceProviderStepInput & {
  readonly guest: GuestConnection;
  readonly machineId: MachineIdInput['machineId'];
};

/** Releases the committed or failed generation while preserving the guest home files. */
export async function releaseWorkspace({ store, guest, machineId }: ReleaseWorkspaceInput): Promise<boolean> {
  const state = store.workspace();
  const recovery = Option.filter(state.recovery, (value) => value.machineId === machineId);
  const head = Option.orElse(recovery, () => state.head);

  if (Option.isNone(head)) {
    return true;
  }

  return await releaseWorkspaceGeneration({ guest, machineId, generation: head.value.generation });
}

type ReleaseGenerationInput = {
  readonly guest: GuestConnection;
  readonly machineId: MachineIdInput['machineId'];
  readonly generation: RecordId;
};

/** An acknowledged release drops one known generation's scratch and fence, preserving the guest home. */
export async function releaseWorkspaceGeneration({
  guest,
  machineId,
  generation,
}: ReleaseGenerationInput): Promise<boolean> {
  const part = Option.none();

  const response = await workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Release,
    part,
    init: { method: HttpMethod.Delete },
  });

  return response.status === HttpStatusCode.Ok;
}
