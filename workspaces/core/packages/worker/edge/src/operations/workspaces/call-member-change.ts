import { callDirectory } from '@mechane/bindings';
import type { WorkerSettings } from '@mechane/bindings';
import type { ObjectUnavailable } from '@mechane/protocol';
import type { PrincipalId, WorkspaceId } from '@mechane/records';
import type { WorkspaceMemberChange } from '@mechane/rpc';
import { Effect } from 'effect';
import type { Schema } from 'effect';
import type { Caller } from '../../types.ts';

type CallMemberChangeInput<S> = {
  readonly settings: WorkerSettings;
  readonly caller: Caller;
  readonly workspaceId: WorkspaceId;
  readonly principalId: PrincipalId;
  readonly change: WorkspaceMemberChange;
  readonly answer: S;
};

/** The directory atomically checks actor ownership while changing the separately identified member. */
export const callMemberChange = Effect.fn('callMemberChange')(function* <S extends Schema.Codec<unknown, unknown>>({
  settings,
  caller,
  workspaceId,
  principalId,
  change,
  answer,
}: CallMemberChangeInput<S>): Effect.fn.Return<S['Type'], ObjectUnavailable> {
  return yield* callDirectory({
    settings,
    call: ({ directory }) =>
      directory.changeWorkspaceMember({
        principalId: caller.principal.id,
        workspaceId,
        memberPrincipalId: principalId,
        change,
      }),
    answer,
  });
});
