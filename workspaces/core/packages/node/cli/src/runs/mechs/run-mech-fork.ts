import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { mechLine } from './mech-line.ts';
import { withWorkspace } from './with-workspace.ts';

/** Forks a mech of the caller's workspace into a new mech under the input's name. */
export const runMechFork = Effect.fn('runMechFork')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'mech fork'>): Effect.fn.Return<CommandResult<'mech fork'>, RunFailure> {
  const mech = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => call({ name: 'forkMech', input: { ...input, workspaceId }, credential: token }),
  });

  return { lines: [mechLine({ mech })], result: mech };
});
