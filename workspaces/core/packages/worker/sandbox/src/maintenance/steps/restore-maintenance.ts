import { SandboxPhase } from '@mechane/protocol';
import { Option } from 'effect';
import { restoreSnapshot } from '../../workspace/snapshots/restore-snapshot.ts';
import { maintenanceValue } from '../maintenance-value.ts';
import type { PortableStepInput } from '../types.ts';
import { maintenanceSnapshot } from './maintenance-snapshot.ts';

/** The target guest must verify every archive byte before the provider binding can change. */
export async function restoreMaintenance({ store, provider, workspace, job }: PortableStepInput): Promise<void> {
  const machineId = maintenanceValue({ value: job.target, field: 'target' });
  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest) || !(await guest.value.health({ machineId }))) {
    return;
  }

  const snapshot = maintenanceSnapshot({ job });
  const isRestored = await restoreSnapshot({ store, provider, workspace, machineId, guest: guest.value, snapshot });

  if (isRestored) {
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Commit });
  }
}
