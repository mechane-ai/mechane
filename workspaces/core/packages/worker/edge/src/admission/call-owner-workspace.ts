import { callWorkspace } from '@mechane/bindings';
import type { ObjectUnavailable, ServiceFreeCodec, WorkspaceNotFound, WorkspaceOwnerRequired } from '@mechane/protocol';
import { Effect } from 'effect';
import type { Caller } from '../types.ts';
import { requireWorkspaceOwner } from './require-workspace-owner.ts';

type CallOwnerWorkspaceInput<Answer extends ServiceFreeCodec> = Parameters<typeof callWorkspace<Answer>>[0] & {
  readonly caller: Caller;
};

/** Each owner RPC rereads membership immediately before crossing the Workspace boundary. */
export const callOwnerWorkspace = Effect.fn('callOwnerWorkspace')(function* <Answer extends ServiceFreeCodec>({
  caller,
  settings,
  workspaceId,
  call,
  answer,
}: CallOwnerWorkspaceInput<Answer>): Effect.fn.Return<
  Answer['Type'],
  ObjectUnavailable | WorkspaceNotFound | WorkspaceOwnerRequired
> {
  yield* requireWorkspaceOwner({ settings, caller, workspaceId });

  return yield* callWorkspace({ settings, workspaceId, call, answer });
});
