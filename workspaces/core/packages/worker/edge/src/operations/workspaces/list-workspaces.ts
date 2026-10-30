import { callDirectory, callWorkspace } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import { WorkspacePolicy } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, Workspace, WorkspaceList } from '@mechane/protocol';
import { DirectoryWorkspaces } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

type WorkspaceWithPolicyInput = { readonly settings: WorkerSettings; readonly workspace: Workspace };

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

  const [personal, ...shared] = workspaces;
  const first = yield* workspaceWithPolicy({ settings, workspace: personal });

  const rest = yield* Effect.forEach(shared, (workspace) => workspaceWithPolicy({ settings, workspace }), {
    concurrency: 1,
  });

  return { workspaces: [first, ...rest] };
});

const workspaceWithPolicy = Effect.fn('workspaceWithPolicy')(function* ({
  settings,
  workspace,
}: WorkspaceWithPolicyInput): Effect.fn.Return<Workspace, ObjectUnavailable> {
  const policy = yield* callWorkspace({
    settings,
    workspaceId: workspace.id,
    call: ({ workspace: object }) => object.policy({ initialAllowanceMicros: workspace.dailyAllowanceMicros }),
    answer: WorkspacePolicy,
  });

  return { ...workspace, dailyAllowanceMicros: policy.dailyAllowanceMicros };
});
