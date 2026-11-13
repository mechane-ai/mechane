import type { SandboxEnvironment } from '../environment.ts';
import type { MachineObject } from '../providers/machine-object.ts';

type MachineStubInput = { readonly environment: SandboxEnvironment; readonly name: string };

/** A sandbox's stable ledger identity names its replaceable compute owner. */
export function machineStub({ environment, name }: MachineStubInput): DurableObjectStub<MachineObject> {
  const namespace = environment.MACHINES;

  return namespace.getByName(name);
}
