import { SandboxPhase } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { observeMachine } from '../../machines/observe-machine.ts';
import { restoreSnapshot } from '../../workspace/snapshots/restore-snapshot.ts';
import { maintenanceValue } from '../maintenance-value.ts';
import type { PortableStepInput } from '../types.ts';

/** The target guest must verify every archive byte before the provider binding can change. */
export async function restoreMaintenance({ store, provider, workspace, job }: PortableStepInput): Promise<void> {
  const machineId = maintenanceValue({ value: job.target, field: 'target' });

  await observeMachine({ store, provider });

  const live = store.liveMachine();

  if (Option.isNone(live) || live.value.id !== machineId) {
    const lastError = Option.some('Replacement machine was lost before workspace restoration completed');

    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Failed, lastError });

    return;
  }

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest) || !(await guest.value.health({ machineId }))) {
    return;
  }

  const snapshot = maintenanceValue({ value: job.source, field: 'source' });
  const isRestored = await restoreSnapshot({ store, provider, workspace, machineId, guest: guest.value, snapshot });

  if (isRestored) {
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Commit });
  }
}
