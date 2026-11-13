import { MachineStatus } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import type { GuestConnection, MachineIdInput, ProviderStepInput } from '../types.ts';

type ConnectLiveMachineInput = ProviderStepInput & MachineIdInput;

/** Provider absence ends the original identity; failed health leaves it available for a later observation. */
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

  if (Option.isNone(guest)) {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });

    return Option.none();
  }

  if (!(await guest.value.health({ machineId }))) {
    return Option.none();
  }

  return guest;
}
