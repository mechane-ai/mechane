import { HttpMethod, HttpStatusCode } from '@mechane/records';
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

  const part = Option.none();

  const response = await workspaceRequest({
    guest,
    machineId,
    generation: head.value.generation,
    step: WorkspaceStep.Release,
    part,
    init: { method: HttpMethod.Delete },
  });

  return response.status === HttpStatusCode.Ok;
}
