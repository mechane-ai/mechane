import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Shows the workspace's daily model allowance and what the current UTC day has committed of it. */
export const runAllowanceShow = Effect.fn('runAllowanceShow')(function* ({
  call,
  origin,
  credentials,
  selectedWorkspaceId,
}: RunInput<'allowance show'>): Effect.fn.Return<CommandResult<'allowance show'>, RunFailure> {
  const allowance = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => call({ name: 'showAllowance', input: { workspaceId }, credential: token }),
  });

  const { day, committedMicros, dailyAllowanceMicros } = allowance;

  return {
    lines: [`${day}: ${committedMicros} of ${dailyAllowanceMicros} micro-dollars committed`],
    result: allowance,
  };
});
