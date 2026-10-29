import type { MechRpc } from '../mech/types.ts';
import type { BindingsInput } from '../types.ts';
import { mechObjectName } from './mech-object-name.ts';
import type { MechObjectNameInput } from './types.ts';

type MechStubInput = BindingsInput & MechObjectNameInput;

/** The stub of a mech's object, named by its workspace's id and its own; a mech that forks calls its new mech's. */
export function mechStub({ bindings, workspaceId, mechId }: MechStubInput): DurableObjectStub<MechRpc> {
  return bindings.mechs.get(bindings.mechs.idFromName(mechObjectName({ workspaceId, mechId })));
}
