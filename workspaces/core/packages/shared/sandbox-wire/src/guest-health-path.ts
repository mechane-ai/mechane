import type { RecordId } from '@mechane/records';
import { GuestSegment } from './constants.ts';

/** The machine whose guest reports its health. */
type GuestHealthPathInput = { readonly machineId: RecordId };

/** The guest's path for a machine's health, which answers once the guest serves it; the id is percent-encoded. */
export function guestHealthPath({ machineId }: GuestHealthPathInput): string {
  const machineSegment = encodeURIComponent(machineId);

  return `/${GuestSegment.Machines}/${machineSegment}/${GuestSegment.Health}`;
}
