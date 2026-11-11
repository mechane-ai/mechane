import { DateTime, Option } from 'effect';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { hasCapturedAutomaticCheckpoint, releaseWorkspace } from './release-workspace.ts';

type ReleaseMachineWorkspaceInput = WorkspaceProviderStepInput & MachineIdInput;

/** Releases completed workspace scratch state before a new command may use the live guest. */
export async function releaseMachineWorkspace({
  store,
  provider,
  workspace,
  machineId,
}: ReleaseMachineWorkspaceInput): Promise<boolean> {
  const state = store.workspace();
  const isLocalSnapshot = Option.exists(state.head, (head) => Option.contains(head.capturedMachineId, machineId));

  if (isLocalSnapshot && Option.isNone(state.recovery)) {
    return true;
  }

  if (Option.isNone(state.head) && Option.isNone(state.recovery) && Option.isNone(state.checkpoint)) {
    return true;
  }

  if (hasCapturedAutomaticCheckpoint({ store, machineId })) {
    return true;
  }

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });

    return false;
  }

  return await releaseWorkspace({ store, provider, workspace, guest: guest.value, machineId });
}
