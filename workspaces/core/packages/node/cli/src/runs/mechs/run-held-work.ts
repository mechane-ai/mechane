import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect, Option } from 'effect';
import { withWorkspace } from './with-workspace.ts';

export const runHeldWork = Effect.fn('runHeldWork')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'history held'>): Effect.fn.Return<CommandResult<'history held'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'listHeldWork', input: { workspaceId, ...input }, credential: token }),
  });

  const lines = result.items.map(({ kind, id, status, recordedOutcome }) => {
    const parts: Array<string> = [kind, id, status];
    const outcome = Option.fromNullishOr(recordedOutcome);

    if (Option.isSome(outcome)) {
      parts.push(outcome.value);
    }

    return parts.join(' ');
  });

  if (Option.isSome(result.nextCursor)) {
    lines.push(`Continue with --after ${result.nextCursor.value}`);
  }

  return { result, lines };
});
