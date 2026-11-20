import type { StoreContext } from '../../context.ts';
import { lockWorkspaceAuthority } from './authority.ts';
import type { WorkspaceActor } from './types.ts';
import { createWorkspaceRecords } from './workspaces.ts';

type AuthorizeWorkspace = WorkspaceActor & { readonly isOwnerRequired: boolean };

export function createConfigurationRecords(context: StoreContext) {
  return {
    ...createWorkspaceRecords(context),
    async authorizeConfigurationWorkspace(input: AuthorizeWorkspace): Promise<void> {
      await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input });
      });
    },
  };
}
