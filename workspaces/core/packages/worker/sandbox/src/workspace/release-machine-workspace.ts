import { DateTime, Option } from 'effect';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { releaseWorkspace } from './release-workspace.ts';

type ReleaseMachineWorkspaceInput = WorkspaceProviderStepInput & MachineIdInput;

/** Releases completed workspace scratch state before a new command may use the live guest. */
export async function releaseMachineWorkspace({
  store,
  provider,
  workspace,
  machineId,
}: ReleaseMachineWorkspaceInput): Promise<boolean> {
  if (Option.isNone(workspace)) {
    return true;
  }

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });

    return false;
  }

  return await releaseWorkspace({ store, provider, workspace: workspace.value, guest: guest.value, machineId });
}
