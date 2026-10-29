import { Option } from 'effect';
import type { GuestConnection, MachineIdInput, WorkspaceTransferInput } from '../types.ts';
import { restoreSnapshot } from './snapshots/restore-snapshot.ts';

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

  return await restoreSnapshot({ store, provider, workspace, guest, machineId, snapshot: state.head.value });
}
