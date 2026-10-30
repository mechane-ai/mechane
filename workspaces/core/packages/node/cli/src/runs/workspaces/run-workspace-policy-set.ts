import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { withCredential } from '@mechane/cli-login';
import { Effect, Option } from 'effect';

/**
 * Targets an explicit workspace through installation administrator access, independent of the current workspace
 * selection.
 */
export const runWorkspacePolicySet = Effect.fn('runWorkspacePolicySet')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'workspace policy set'>): Effect.fn.Return<CommandResult<'workspace policy set'>, RunFailure> {
  const { workspaceId, isCreateOnly, ...policy } = input;
  const requestedCreateOnly = Option.fromUndefinedOr(isCreateOnly);
  const request = { workspaceId, policy, isCreateOnly: Option.getOrElse(requestedCreateOnly, () => false) };

  const result = yield* withCredential({
    origin,
    credentials,
    use: ({ token }) => call({ name: 'setWorkspacePolicy', input: request, credential: token }),
  });

  return { lines: [`updated policy for ${workspaceId}`], result };
});
