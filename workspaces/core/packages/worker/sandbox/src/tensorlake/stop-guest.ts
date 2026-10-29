import { Option } from 'effect';
import type { MachineIdInput } from '../types.ts';
import { readSandbox } from './machines/read-sandbox.ts';
import { suspendSandbox } from './machines/suspend-sandbox.ts';
import { endGuestProcess } from './processes/end-guest-process.ts';
import type { TensorlakeSettings } from './types.ts';

type StopGuestInput = TensorlakeSettings & MachineIdInput;

/** Ends the command runner before sleeping its VM, keeping the workspace files for the next machine identity. */
export async function stopGuest({ machineId, ...settings }: StopGuestInput): Promise<void> {
  const found = await readSandbox(settings);

  if (Option.isNone(found)) {
    return;
  }

  const origin = found.value.origin;

  if (Option.isSome(origin)) {
    await endGuestProcess({ apiKey: settings.apiKey, origin: origin.value, machineId });
  }

  await suspendSandbox(settings);
}
