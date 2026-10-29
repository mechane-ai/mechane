import { MachineStatus } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import type { MachineIdInput, ProviderStepInput } from '../types.ts';
import { failLateMachine } from './fail-late-machine.ts';

type LoseStoppedMachineInput = ProviderStepInput & MachineIdInput;

/**
 * Observes the live machine before anything is sent to it. A ready machine that stopped running ends, and each
 * execution it held without a receipt becomes uncertain. A starting machine is judged only by its startup deadline.
 */
export async function observeMachine({ store, provider }: ProviderStepInput): Promise<void> {
  const live = store.liveMachine();

  if (Option.isNone(live)) {
    return;
  }

  const { id: machineId, status, startedAt } = live.value;

  switch (status) {
    case MachineStatus.Ready:
      await loseStoppedMachine({ store, provider, machineId });

      break;
    case MachineStatus.Starting:
      await failLateMachine({ store, provider, machineId, startedAt });
  }
}

/** Ends a ready machine that stopped running; each execution it held without a receipt becomes uncertain. */
async function loseStoppedMachine({ store, provider, machineId }: LoseStoppedMachineInput): Promise<void> {
  if (Option.isNone(await provider.connect({ machineId }))) {
    store.loseMachine({ machineId, now: DateTime.nowUnsafe() });
  }
}
