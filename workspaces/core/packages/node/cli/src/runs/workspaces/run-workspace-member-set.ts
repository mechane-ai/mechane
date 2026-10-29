import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { workspaceMemberLine } from './workspace-member-line.ts';

/** A role applies to an existing principal in the selected shared workspace. */
export const runWorkspaceMemberSet = Effect.fn('runWorkspaceMemberSet')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'workspace member set'>): Effect.fn.Return<CommandResult<'workspace member set'>, RunFailure> {
  const member = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'setWorkspaceMember', input: { ...input, workspaceId }, credential: token }),
  });

  const line = workspaceMemberLine(member);

  return { lines: [line], result: member };
});
