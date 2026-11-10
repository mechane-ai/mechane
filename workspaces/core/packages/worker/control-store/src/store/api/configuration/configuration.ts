import type { StoreContext } from '../../context.ts';
import { lockWorkspaceAuthority, requireWorkspaceMech } from './authority.ts';
import { createConnectionRecords } from './connections.ts';
import { createExecutionConfigurationRecords } from './execution.ts';
import type { WorkspaceActor } from './types.ts';
import { createWorkspaceRecords } from './workspaces.ts';

type AuthorizeWorkspace = WorkspaceActor & { readonly isOwnerRequired: boolean; readonly mechId?: string };

export function createConfigurationRecords(context: StoreContext) {
  return {
    ...createWorkspaceRecords(context),
    ...createConnectionRecords(context),
    ...createExecutionConfigurationRecords(context),
    async authorizeConfigurationWorkspace(input: AuthorizeWorkspace): Promise<void> {
      await context.atomic(async (transaction) => {
        await lockWorkspaceAuthority({ context: transaction, ...input });

        if (input.mechId !== undefined) {
          await requireWorkspaceMech({ context: transaction, workspaceId: input.workspaceId, mechId: input.mechId });
        }
      });
    },
  };
}
