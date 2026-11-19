import type { WorkspaceId } from '@mechane/records';

type Selection = { readonly workspaceId: typeof WorkspaceId.Encoded };

/** Public workspace identifier for the owning installation or a private Console workspace. */
export function managedWorkspaceId({ workspaceId }: Selection): string {
  return `wrkspc_${workspaceId.toLowerCase().replaceAll('-', '')}`;
}
