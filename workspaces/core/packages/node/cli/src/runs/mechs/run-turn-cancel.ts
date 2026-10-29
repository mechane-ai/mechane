import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { DateTime, Effect } from 'effect';
import { withWorkspace } from './with-workspace.ts';

/** Cancels a running turn of a mech; a repeat answers the turn's first cancel. */
export const runTurnCancel = Effect.fn('runTurnCancel')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'turn cancel'>): Effect.fn.Return<CommandResult<'turn cancel'>, RunFailure> {
  const cancel = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => call({ name: 'cancelTurn', input: { ...input, workspaceId }, credential: token }),
  });

  const { turnId, canceledAt, cancelerId } = cancel;

  return { lines: [`turn ${turnId} canceled at ${DateTime.formatIso(canceledAt)} by ${cancelerId}`], result: cancel };
});
