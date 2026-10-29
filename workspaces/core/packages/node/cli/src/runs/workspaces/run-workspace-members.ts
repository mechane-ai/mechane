import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { workspaceMemberLine } from './workspace-member-line.ts';

/** The owner-visible roster includes principal IDs for subsequent membership commands. */
export const runWorkspaceMembers = Effect.fn('runWorkspaceMembers')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
}: RunInput<'workspace members'>): Effect.fn.Return<CommandResult<'workspace members'>, RunFailure> {
  const list = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => call({ name: 'listWorkspaceMembers', input: { workspaceId }, credential: token }),
  });

  const lines = list.members.map(workspaceMemberLine);

  return { lines, result: list };
});
