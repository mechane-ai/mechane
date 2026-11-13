import { MachineId } from '@mechane/records';
import { SandboxAction, SandboxPhase } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { observeMachine } from '../../machines/observe-machine.ts';
import { startMachine } from '../../machines/start-machine.ts';
import { refusePortableMaintenance } from '../refuse-portable-maintenance.ts';
import type { PortableStepInput } from '../types.ts';
import { requireWorkspaceRestore } from '../workspace-restore-fence.ts';

/** Persists the replacement identity before starting its credential-free guest. */
export async function startMaintenanceMachine({ store, provider, job }: PortableStepInput): Promise<void> {
  if (Option.isNone(job.target)) {
    if (job.action === SandboxAction.Restore) {
      const record = requireWorkspaceRestore({ store, job });
      const machines = new Set([record.request.machineId, record.previousMachineId]);
      const probes = Array.from(machines, (machineId) => provider.isAbsent({ machineId }));
      const observations = await Promise.all(probes);
      const isAbsent = observations.every(Boolean);

      if (!isAbsent) {
        return refusePortableMaintenance({ reason: 'the original provider machine is active; restore refused' });
      }

      requireWorkspaceRestore({ store, job });
    }

    await stopPreviousMachine({ store, provider });

    if (job.action === SandboxAction.Restore) {
      requireWorkspaceRestore({ store, job });
    }

    const machineId = MachineId.make(crypto.randomUUID());
    const target = Option.some(machineId);
    const now = DateTime.nowUnsafe();

    const record: () => void = () => {
      store.openMachine({ machineId, now });
      store.savePortableMaintenance({ ...job, target });
    };

    store.atomic({ run: record });

    return;
  }

  await observeMachine({ store, provider });

  const live = store.liveMachine();

  if (Option.isNone(live) || live.value.id !== job.target.value) {
    const lastError = Option.some('Replacement machine was lost before startup completed');

    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Failed, lastError });

    return;
  }

  await startMachine({ store, provider, machine: live.value });
  store.savePortableMaintenance({ ...job, phase: SandboxPhase.Restore });
}

async function stopPreviousMachine({ store, provider }: Pick<PortableStepInput, 'store' | 'provider'>): Promise<void> {
  const previous = store.latestMachine();

  if (Option.isNone(previous)) {
    return;
  }

  const machineId = previous.value.id;
  const now = DateTime.nowUnsafe();

  store.loseMachine({ machineId, now });
  await provider.stop({ machineId });
}
