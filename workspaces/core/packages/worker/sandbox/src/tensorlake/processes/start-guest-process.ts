import { HttpMethod } from '@mechane/records';
import type { SandboxStore } from '@mechane/sandbox-store';
import { GUEST_VARIABLES, GuestScope } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { TensorlakePath } from '../constants.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import { endGuestProcess } from './end-guest-process.ts';
import type { RemoteProcessInput } from './types.ts';

type StartGuestProcessInput = RemoteProcessInput & { readonly store: SandboxStore };
const GUEST_COMMAND = '/usr/local/bin/node';
const GUEST_MODULE = '/opt/mechane/guest.mjs';
const GUEST_HOME = '/home/node';
const GUEST_USER = 'node';

/** Starts a new receipt ledger only after the previous guest and its command groups have ended. */
export async function startGuestProcess({ apiKey, origin, machineId, store }: StartGuestProcessInput): Promise<void> {
  const previous = store.remoteGuest();

  if (Option.isSome(previous) && previous.value !== machineId) {
    await endGuestProcess({ apiKey, origin, machineId: previous.value });
  }

  const url = new URL(TensorlakePath.Processes, origin);

  const body = JSON.stringify({
    name: machineId,
    command: GUEST_COMMAND,
    args: [GUEST_MODULE],
    env: { [GUEST_VARIABLES.machineId]: machineId, [GUEST_VARIABLES.scope]: GuestScope.Process },
    working_dir: GUEST_HOME,
    user: GUEST_USER,
    restart: { policy: 'never' },
  });

  store.bindRemoteGuest({ machineId });
  await tensorlakeRequest({ apiKey, url, init: { method: HttpMethod.Post, body } });
}
