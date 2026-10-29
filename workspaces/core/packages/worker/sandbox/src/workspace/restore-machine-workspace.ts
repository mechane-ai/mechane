import { Option } from 'effect';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { restoreWorkspace } from './restore-workspace.ts';

type RestoreMachineWorkspaceInput = WorkspaceProviderStepInput & MachineIdInput;

/** Restores portable files before a replacement machine is allowed to become ready. */
export async function restoreMachineWorkspace({
  store,
  provider,
  workspace,
  machineId,
}: RestoreMachineWorkspaceInput): Promise<boolean> {
  if (Option.isNone(workspace)) {
    return true;
  }

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    return false;
  }

  return await restoreWorkspace({ store, provider, workspace: workspace.value, guest: guest.value, machineId });
}
