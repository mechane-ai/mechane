import { MachineId } from '@mechane/records';
import { MachineStatus } from '@mechane/sandbox-store';
import type { LiveMachineRow } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import type { ProviderStepInput } from '../types.ts';

/**
 * The live machine, or a new one. Deciding that none is live and recording the new one as starting are one transaction.
 * A starting identity retries its idempotent provider start, including admission interrupted before acknowledgement.
 */
export async function openLiveMachine({ store, provider }: ProviderStepInput): Promise<LiveMachineRow> {
  const machineId = MachineId.make(crypto.randomUUID());

  const openMachine: () => LiveMachineRow = () => {
    const live = store.liveMachine();

    if (Option.isSome(live)) {
      return live.value;
    }

    const now = DateTime.nowUnsafe();

    store.openMachine({ machineId, now });

    return { id: machineId, status: MachineStatus.Starting, startedAt: now };
  };

  const opened = store.atomic({ run: openMachine });

  if (opened.status === MachineStatus.Starting) {
    await provider.start({ machineId: opened.id });
  }

  return opened;
}
