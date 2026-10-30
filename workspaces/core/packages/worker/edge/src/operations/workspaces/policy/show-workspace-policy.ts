import { callWorkspacePolicy } from '@mechane/bindings';
import type {
  catalog,
  InstallationAdministratorRequired,
  ObjectUnavailable,
  WorkspaceNotFound,
  WorkspacePolicy,
} from '@mechane/protocol';
import { Effect } from 'effect';
import type { WorkInput } from '../../../routing/types.ts';
import { requireManagedWorkspace } from './require-managed-workspace.ts';

/** Administrators see the limits currently enforced after installation ceilings are applied. */
export const showWorkspacePolicy = Effect.fn('showWorkspacePolicy')(function* ({
  settings,
  caller,
  input,
}: WorkInput<typeof catalog.showWorkspacePolicy>): Effect.fn.Return<
  WorkspacePolicy,
  InstallationAdministratorRequired | ObjectUnavailable | WorkspaceNotFound
> {
  yield* requireManagedWorkspace({ settings, caller, workspaceId: input.workspaceId });

  return yield* callWorkspacePolicy({ settings, workspaceId: input.workspaceId });
});
