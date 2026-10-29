import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { withCredential } from '@mechane/cli-login';
import { Effect, Option } from 'effect';
import { prepareWorkspaceCreation } from './prepare-workspace-creation.ts';
import { workspaceLine } from './workspace-line.ts';

/** Shared workspace creation binds the printed retry ID to one administrator request. */
export const runWorkspaceCreate = Effect.fn('runWorkspaceCreate')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'workspace create'>): Effect.fn.Return<CommandResult<'workspace create'>, RunFailure> {
  const requestedId = Option.fromUndefinedOr(input.id);
  const id = prepareWorkspaceCreation({ requestedId });

  const workspace = yield* withCredential({
    origin,
    credentials,
    use: ({ token }) => call({ name: 'createWorkspace', input: { id, name: input.name }, credential: token }),
  });

  const line = workspaceLine(workspace);

  return { lines: [line], result: workspace };
});
