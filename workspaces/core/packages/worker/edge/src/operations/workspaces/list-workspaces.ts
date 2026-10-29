import { callDirectory } from '@mechane/bindings';
import type { catalog, ObjectUnavailable, WorkspaceList } from '@mechane/protocol';
import { DirectoryWorkspaces } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Lists the workspaces the caller is a member of, oldest first, with the caller's role in each. */
export const listWorkspaces = Effect.fn('listWorkspaces')(function* ({
  settings,
  caller,
}: WorkInput<typeof catalog.listWorkspaces>): Effect.fn.Return<WorkspaceList, ObjectUnavailable> {
  const workspaces = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.workspacesOfPrincipal({ principalId: caller.principal.id }),
    answer: DirectoryWorkspaces,
  });

  return { workspaces };
});
