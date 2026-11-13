import { Option } from 'effect';
import type { DateTime } from 'effect';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { restoreWorkspace } from './restore-workspace.ts';

type RestoreMachineWorkspaceInput = WorkspaceProviderStepInput & MachineIdInput & { readonly deadline: DateTime.Utc };

/** Restores portable files before a replacement machine is allowed to become ready. */
export async function restoreMachineWorkspace({
  store,
  provider,
  workspace,
  machineId,
  deadline,
}: RestoreMachineWorkspaceInput): Promise<boolean> {
  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    return false;
  }

  return await restoreWorkspace({ store, provider, workspace, guest: guest.value, machineId, deadline });
}
