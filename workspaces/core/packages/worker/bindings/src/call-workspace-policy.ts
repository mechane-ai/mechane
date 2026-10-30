import { DurableObjectClass, ObjectUnavailable } from '@mechane/protocol';
import type { WorkspacePolicy } from '@mechane/protocol';
import type { WorkspaceId } from '@mechane/records';
import { readWorkspacePolicy } from '@mechane/rpc';
import { Effect } from 'effect';
import type { WorkerSettings } from './types.ts';

type CallWorkspacePolicyInput = { readonly settings: WorkerSettings; readonly workspaceId: typeof WorkspaceId.Encoded };

/** Reads current workspace policy without caching and sanitizes RPC failure details. */
export const callWorkspacePolicy = Effect.fn('callWorkspacePolicy')(function* ({
  settings,
  workspaceId,
}: CallWorkspacePolicyInput): Effect.fn.Return<WorkspacePolicy, ObjectUnavailable> {
  return yield* Effect.tryPromise({
    try: () => readWorkspacePolicy({ bindings: settings, workspaceId }),
    catch: () =>
      new ObjectUnavailable({ objectClass: DurableObjectClass.Workspace, reason: 'workspace policy is unavailable' }),
  });
});
