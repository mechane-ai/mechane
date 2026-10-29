import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Removal targets the selected shared workspace while the service preserves its final owner. */
export const runWorkspaceMemberRemove = Effect.fn('runWorkspaceMemberRemove')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'workspace member remove'>): Effect.fn.Return<CommandResult<'workspace member remove'>, RunFailure> {
  const removed = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'removeWorkspaceMember', input: { ...input, workspaceId }, credential: token }),
  });

  return { lines: [`removed ${removed.principalId}`], result: removed };
});
