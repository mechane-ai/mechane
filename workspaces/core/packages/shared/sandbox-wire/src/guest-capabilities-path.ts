import type { MachineId } from '@mechane/records';
import { GuestSegment } from './constants.ts';

type GuestCapabilitiesPathInput = { readonly machineId: MachineId };

/** Addresses capability discovery on the already selected machine. */
export function guestCapabilitiesPath({ machineId }: GuestCapabilitiesPathInput): string {
  const machine = encodeURIComponent(machineId);

  return `/${GuestSegment.Machines}/${machine}/${GuestSegment.Capabilities}`;
}
