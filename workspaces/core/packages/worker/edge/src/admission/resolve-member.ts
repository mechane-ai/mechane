import { callDirectory } from '@mechane/bindings';
import { RequestInvalid, WorkspaceNotFound, WorkspacePath, WorkspaceSuspended } from '@mechane/protocol';
import type { AuthenticationFailure, ObjectUnavailable } from '@mechane/protocol';
import { WorkspaceMembership } from '@mechane/rpc';
import { Effect, Match, Schema } from 'effect';
import type { Caller } from '../types.ts';
import { resolveCaller } from './resolve-caller.ts';
import type { AdmitInput } from './types.ts';

/**
 * Resolves the request's bearer key, and admits its caller only as a member of the workspace the path names, by the
 * directory's current membership. A workspace the caller does not belong to is not found, exactly as a missing one is.
 * A member of a workspace the operator suspended is refused.
 */
export const resolveMember = Effect.fn('resolveMember')(function* ({
  request,
  params,
  settings,
}: AdmitInput): Effect.fn.Return<
  Caller,
  AuthenticationFailure | ObjectUnavailable | RequestInvalid | WorkspaceNotFound | WorkspaceSuspended
> {
  // The path's other parameters are the operation's to decode, after admission.
  const { workspaceId } = yield* Schema.decodeUnknownEffect(WorkspacePath)(params).pipe(
    Effect.mapError((error) => new RequestInvalid({ reason: error.message })),
  );

  const { key, principal } = yield* resolveCaller({ request, params, settings });

  const membership = yield* callDirectory({
    settings,
    call: ({ directory }) => directory.workspaceMembership({ principalId: principal.id, workspaceId }),
    answer: WorkspaceMembership,
  });

  yield* Match.valueTags(membership, {
    Member: () => Effect.void,
    NotMember: () => new WorkspaceNotFound({ workspaceId }),
  });

  if (settings.suspendedWorkspaces.includes(workspaceId)) {
    return yield* new WorkspaceSuspended({ workspaceId });
  }

  return { key, principal };
});
