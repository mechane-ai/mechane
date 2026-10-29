import { MachineStatus } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { Option } from 'effect';
import { ProcessStatus } from '../constants.ts';
import { readProcess } from './read-process.ts';
import { startGuestProcess } from './start-guest-process.ts';
import type { RemoteProcessInput } from './types.ts';

type GuestProcessInput = RemoteProcessInput & { readonly store: SandboxStore };

/** Reuses the named guest; a disappeared ready guest cannot restart with an empty execution ledger. */
export async function guestProcess({ store, ...input }: GuestProcessInput): Promise<boolean> {
  const found = await readProcess(input);

  if (Option.isSome(found)) {
    if (found.value.status !== ProcessStatus.Running) {
      return false;
    }

    store.bindRemoteGuest({ machineId: input.machineId });

    return true;
  }

  const live = store.liveMachine();

  if (Option.isNone(live)) {
    return false;
  }

  const isStarting = live.value.id === input.machineId && live.value.status === MachineStatus.Starting;

  if (!isStarting) {
    return false;
  }

  await startGuestProcess({ ...input, store });

  return true;
}
