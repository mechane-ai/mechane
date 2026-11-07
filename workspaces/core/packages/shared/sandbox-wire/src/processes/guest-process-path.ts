import type { RecordId } from '@mechane/records';
import { GuestSegment } from '../constants.ts';
import type { ProcessId } from './process.schemas.ts';

type GuestProcessesPathInput = { readonly machineId: RecordId };
type GuestProcessPathInput = GuestProcessesPathInput & { readonly processId: ProcessId };

/** The bounded summary-list route for one existing guest machine. */
export function guestProcessesPath({ machineId }: GuestProcessesPathInput): string {
  const machine = encodeURIComponent(machineId);

  return `/${GuestSegment.Machines}/${machine}/${GuestSegment.Processes}`;
}

/** The start, read, or stop route for a machine-bound process identity. */
export function guestProcessPath({ machineId, processId }: GuestProcessPathInput): string {
  const collection = guestProcessesPath({ machineId });
  const identity = encodeURIComponent(processId);

  return `${collection}/${identity}`;
}
