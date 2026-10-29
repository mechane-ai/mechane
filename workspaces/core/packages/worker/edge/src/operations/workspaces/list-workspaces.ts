import { callDirectory } from '@mechane/bindings';
import type { catalog, ObjectUnavailable, WorkspaceList } from '@mechane/protocol';
import { DirectoryWorkspaces } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Personal-first ordering preserves the CLI default when a shared workspace predates the principal. */
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
