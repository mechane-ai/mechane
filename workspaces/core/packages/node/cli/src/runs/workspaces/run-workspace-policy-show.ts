import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { withCredential } from '@mechane/cli-login';
import { Effect } from 'effect';

/** Administrator access can read effective policy even when ordinary member access is suspended. */
export const runWorkspacePolicyShow = Effect.fn('runWorkspacePolicyShow')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'workspace policy show'>): Effect.fn.Return<CommandResult<'workspace policy show'>, RunFailure> {
  const result = yield* withCredential({
    origin,
    credentials,
    use: ({ token }) => call({ name: 'showWorkspacePolicy', input, credential: token }),
  });

  return { lines: [JSON.stringify(result)], result };
});
