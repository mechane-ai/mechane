import { SandboxAction, SandboxPhase, SandboxRestoreResult, StartupPhase } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { maintenanceValue } from '../maintenance-value.ts';
import { refusePortableMaintenance } from '../refuse-portable-maintenance.ts';
import type { PortableStepInput } from '../types.ts';
import { requireWorkspaceRestore } from '../workspace-restore-fence.ts';

export function commitMaintenance({ store, job }: PortableStepInput): void {
  const machineId = maintenanceValue({ value: job.target, field: 'target' });
  const now = DateTime.nowUnsafe();

  store.atomic({
    run: () => {
      if (job.action === SandboxAction.Restore) {
        const original = requireWorkspaceRestore({ store, job });
        const live = store.liveMachine();

        if (!Option.exists(live, (machine) => machine.id === machineId)) {
          return refusePortableMaintenance({ reason: 'the replacement machine was lost before restore commit' });
        }

        const result = SandboxRestoreResult.cases.Restored.make({
          operationId: job.id,
          machineId,
          generation: original.source.generation,
        });

        store.clearRestoredRecovery(original.request);
        store.finishWorkspaceRestore({ operationId: job.id, result });
      }

      store.advanceStartup({ machineId, phase: StartupPhase.Ready, now });
      store.readyMachine({ machineId, now });
      store.savePortableMaintenance({ ...job, phase: SandboxPhase.Done });
    },
  });
}
