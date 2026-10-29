import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { DateTime, Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';

/** Cancels a running drone of a mech; a repeat answers the drone's first cancel. */
export const runDroneCancel = Effect.fn('runDroneCancel')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'drone cancel'>): Effect.fn.Return<CommandResult<'drone cancel'>, RunFailure> {
  const cancel = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) => call({ name: 'cancelDrone', input: { ...input, workspaceId }, credential: token }),
  });

  const { droneId, canceledAt, cancelerId } = cancel;

  return { lines: [`drone ${droneId} canceled at ${DateTime.formatIso(canceledAt)} by ${cancelerId}`], result: cancel };
});
