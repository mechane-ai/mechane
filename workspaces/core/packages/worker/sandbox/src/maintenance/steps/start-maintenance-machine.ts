import { RecordId } from '@mechane/records';
import { SandboxPhase } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { observeMachine } from '../../machines/observe-machine.ts';
import type { PortableStepInput } from '../types.ts';

/** Persists the replacement identity before starting its credential-free guest. */
export async function startMaintenanceMachine({ store, provider, job }: PortableStepInput): Promise<void> {
  if (Option.isNone(job.target)) {
    await stopPreviousMachine({ store, provider });

    const machineId = RecordId.make(crypto.randomUUID());
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
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Failed });

    return;
  }

  await provider.start({ machineId: job.target.value });
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
