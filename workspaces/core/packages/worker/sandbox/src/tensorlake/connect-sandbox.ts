import { HttpStatusCode } from '@mechane/records';
import { Option } from 'effect';
import { GuestAnswer } from '../schemas.ts';
import type { GuestConnection, MachineIdInput } from '../types.ts';
import { TensorlakeStatus } from './constants.ts';
import { readSandbox } from './machines/read-sandbox.ts';
import { startSandbox } from './machines/start-sandbox.ts';
import { guestProcess } from './processes/guest-process.ts';
import { tensorlakeGuest } from './tensorlake-guest.ts';
import type { TensorlakeSettings } from './types.ts';

type ConnectSandboxInput = TensorlakeSettings & MachineIdInput;

const WAKING_GUEST: Readonly<GuestConnection> = {
  fetch: async () => new Response(null, { status: HttpStatusCode.Unavailable }),
  health: async () => false,
  execute: async () => GuestAnswer.cases.Unsettled.make({}),
};

/** Connects to the same receipt ledger after waking; transient provider states never imply a lost machine. */
export async function connectSandbox({
  machineId,
  ...settings
}: ConnectSandboxInput): Promise<Option.Option<GuestConnection>> {
  const found = await readSandbox(settings);

  if (Option.isNone(found)) {
    return Option.none();
  }

  const sandbox = found.value;

  if (sandbox.status === TensorlakeStatus.Terminated) {
    return Option.none();
  }

  if (sandbox.status !== TensorlakeStatus.Running || Option.isNone(sandbox.origin)) {
    await startSandbox(settings);

    return Option.some(WAKING_GUEST);
  }

  const origin = sandbox.origin.value;
  const isRunning = await guestProcess({ apiKey: settings.apiKey, store: settings.store, origin, machineId });

  if (!isRunning) {
    return Option.none();
  }

  const guest = tensorlakeGuest({ origin, apiKey: settings.apiKey });

  return Option.some(guest);
}
