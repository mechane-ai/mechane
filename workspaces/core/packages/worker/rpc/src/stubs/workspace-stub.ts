import type { ObjectBindings } from '../types.ts';
import type { WorkspaceRpc } from '../workspace.types.ts';

type WorkspaceStubInput = { readonly bindings: ObjectBindings; readonly workspaceId: string };

/** The stub of a workspace's object, which the workspace's id names. */
export function workspaceStub({ bindings, workspaceId }: WorkspaceStubInput): DurableObjectStub<WorkspaceRpc> {
  return bindings.workspaces.get(bindings.workspaces.idFromName(workspaceId));
}
