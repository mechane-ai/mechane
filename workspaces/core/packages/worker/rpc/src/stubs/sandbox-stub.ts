import type { BindingsInput, SandboxRpc } from '../types.ts';
import { sandboxObjectName } from './sandbox-object-name.ts';
import type { SandboxOwner } from './types.ts';

type SandboxStubInput = BindingsInput & SandboxOwner;

/** The stub of a sandbox of a mech, which only that mech's object calls, by the sandbox's object name. */
export function sandboxStub({
  bindings,
  workspaceId,
  mechId,
  droneId,
}: SandboxStubInput): DurableObjectStub<SandboxRpc> {
  return bindings.sandboxes.get(bindings.sandboxes.idFromName(sandboxObjectName({ workspaceId, mechId, droneId })));
}
