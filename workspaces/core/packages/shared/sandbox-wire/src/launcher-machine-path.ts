import type { RecordId } from '@mechane/records';
import { GuestSegment } from './constants.ts';

/** The host machine the launcher starts, reports or stops. */
type LauncherMachinePathInput = { readonly machineId: RecordId };

/**
 * The host launcher's path for one machine: PUT starts it once, GET observes without allocating, and DELETE requests
 * its stop. The id is percent-encoded.
 */
export function launcherMachinePath({ machineId }: LauncherMachinePathInput): string {
  const machineSegment = encodeURIComponent(machineId);

  return `/${GuestSegment.Machines}/${machineSegment}`;
}
