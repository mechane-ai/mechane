import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import { maintenanceValue } from '../maintenance-value.ts';
import type { PortableStepInput } from '../types.ts';
import { maintenanceSnapshot } from './maintenance-snapshot.ts';

/** The provider changes only after the target guest has verified the complete archive. */
export function commitMaintenance({ store, job }: PortableStepInput): void {
  const machineId = maintenanceValue({ value: job.target, field: 'target' });
  const now = DateTime.nowUnsafe();

  const commit: () => void = () => {
    if (job.action === SandboxAction.Import) {
      const snapshot = maintenanceSnapshot({ job });
      const sandboxId = Option.none();

      store.commitWorkspace(snapshot);
      store.replaceProvider({ provider: job.provider });
      store.replaceRemoteSandbox({ sandboxId });
    }

    store.readyMachine({ machineId, now });
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Done });
  };

  store.atomic({ run: commit });
}
