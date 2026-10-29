import { HttpStatusCode } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import type { ServedAnswer } from '../types.ts';
import type { HostMachines } from './types.ts';

type StopMachineInput = { readonly machines: HostMachines; readonly machineId: RecordId };

/** Asks the machine's guest to stop, which stops every execution still running on it. */
export function stopMachine({ machines, machineId }: StopMachineInput): ServedAnswer {
  machines.stop({ machineId });

  return { status: HttpStatusCode.NoContent, headers: {}, body: '' };
}
