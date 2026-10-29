import type { RecordId } from '@mechane/records';
import { GuestSegment } from './constants.ts';

/** The host machine the launcher starts, reports or stops. */
type LauncherMachinePathInput = { readonly machineId: RecordId };

/**
 * The host launcher's path for one machine, which a `PUT` starts and reports and a `DELETE` stops; the id is
 * percent-encoded.
 */
export function launcherMachinePath({ machineId }: LauncherMachinePathInput): string {
  const machineSegment = encodeURIComponent(machineId);

  return `/${GuestSegment.Machines}/${machineSegment}`;
}
