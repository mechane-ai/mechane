import type { RecordId } from '@mechane/records';
import { ExecutionId, SourceStep } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { cancelExecution } from '../../executions/cancel-execution.ts';
import type { ProviderStepInput } from '../../types.ts';
import { callSourceGuest } from '../guest/call-source-guest.ts';
import type { SourceFinalizeInput } from '../types.ts';

type AbandonPreparationInput = Omit<SourceFinalizeInput, 'workspace'>;
type RetirePreparedMachineInput = ProviderStepInput & { readonly machineId: RecordId };

/** Preserves a failed live checkpoint while abandoning preparation; every disposable machine is stopped. */
export async function releasePreparation({ store, provider, fence }: AbandonPreparationInput): Promise<void> {
  const live = store.liveMachine();
  const liveId = Option.map(live, (machine) => machine.id);
  const machineId = Option.orElse(fence.machineId, () => liveId);
  const recovery = store.workspace().recovery;

  if (Option.isSome(machineId) && Option.isSome(recovery) && recovery.value.machineId === machineId.value) {
    const guest = await provider.connect({ machineId: machineId.value });

    if (Option.isSome(guest)) {
      const body = Option.none<string>();

      await callSourceGuest({
        ...fence,
        guest: guest.value,
        machineId: machineId.value,
        step: SourceStep.Release,
        body,
      });
    }

    return;
  }

  const executionName = `source-prepare-${fence.generation}`;
  const executionId = ExecutionId.make(executionName);

  await cancelExecution({ store, provider, executionId });

  if (Option.isNone(machineId)) {
    return;
  }

  await retirePreparedMachine({ store, provider, machineId: machineId.value });
}

async function retirePreparedMachine({ store, provider, machineId }: RetirePreparedMachineInput): Promise<void> {
  const checkpoint = store.workspace().checkpoint;

  const retire: () => void = () => {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });

    if (Option.isSome(checkpoint) && checkpoint.value.machineId === machineId) {
      store.retireWorkspace({ generation: checkpoint.value.generation });
    }
  };

  store.atomic({ run: retire });
  await provider.stop({ machineId });
}
