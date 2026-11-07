import { MachineStatus } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import type { GuestConnection, MachineIdInput, ProviderStepInput } from '../types.ts';

type ConnectLiveMachineInput = ProviderStepInput & MachineIdInput;

/** Connects only an already-ready original machine; failed health retires its durable handles without replacement. */
export async function connectLiveMachine({
  store,
  provider,
  machineId,
}: ConnectLiveMachineInput): Promise<Option.Option<GuestConnection>> {
  const live = store.liveMachine();

  if (Option.isNone(live) || live.value.id !== machineId || live.value.status === MachineStatus.Starting) {
    return Option.none();
  }

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest) || !(await guest.value.health({ machineId }))) {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });

    return Option.none();
  }

  return guest;
}
