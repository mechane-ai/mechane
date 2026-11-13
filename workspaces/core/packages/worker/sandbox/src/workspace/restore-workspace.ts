import { Option } from 'effect';
import type { DateTime } from 'effect';
import type { GuestConnection, MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { restoreSnapshot } from './snapshots/restore-snapshot.ts';

type RestoreWorkspaceInput = WorkspaceProviderStepInput & {
  readonly guest: GuestConnection;
  readonly machineId: MachineIdInput['machineId'];
  readonly deadline: DateTime.Utc;
};

/** Resumes a committed snapshot transfer and verifies its archive before the machine becomes ready. */
export async function restoreWorkspace({
  store,
  provider,
  workspace,
  guest,
  machineId,
  deadline,
}: RestoreWorkspaceInput): Promise<boolean> {
  const state = store.workspace();

  if (Option.isNone(state.head)) {
    return true;
  }

  const admissionDeadline = Option.some(deadline);

  return await restoreSnapshot({
    store,
    provider,
    workspace,
    guest,
    machineId,
    snapshot: state.head.value,
    deadline: admissionDeadline,
  });
}
