import { SandboxPhase } from '@mechane/sandbox-wire';
import { DateTime } from 'effect';
import { maintenanceValue } from '../maintenance-value.ts';
import type { PortableStepInput } from '../types.ts';

export function commitMaintenance({ store, job }: PortableStepInput): void {
  const machineId = maintenanceValue({ value: job.target, field: 'target' });
  const now = DateTime.nowUnsafe();

  store.atomic({
    run: () => {
      store.readyMachine({ machineId, now });
      store.savePortableMaintenance({ ...job, phase: SandboxPhase.Done });
    },
  });
}
