import type { RecordsInput } from '@mechane/store';
import type { BindRemoteGuestInput } from '../types.ts';

type BindGuestInput = RecordsInput & BindRemoteGuestInput;

/** Records the guest identity that must be stopped before another guest can reuse the workspace. */
export function bindRemoteGuest({ sql, machineId }: BindGuestInput): void {
  sql.exec('UPDATE remote_sandbox SET guest_machine_id = ? WHERE slot = 1', machineId);
}
