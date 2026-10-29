import { launcherMachinePath } from '@mechane/sandbox-wire';
import type { HostMachineInput } from './types.ts';

type MachineUrlInput = Pick<HostMachineInput, 'launcherOrigin' | 'machineId'>;

/** The host launcher's URL for one machine, which a `PUT` starts and reports and a `DELETE` stops. */
export function machineUrl({ launcherOrigin, machineId }: MachineUrlInput): URL {
  return new URL(launcherMachinePath({ machineId }), launcherOrigin);
}
