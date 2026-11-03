import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from './with-workspace.ts';

/** Admission returns immediately; the request ID addresses its durable result. */
export const runBoundedTurnSubmit = Effect.fn('runBoundedTurnSubmit')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'bounded-turn submit'>): Effect.fn.Return<CommandResult<'bounded-turn submit'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'submitBoundedTurn', input: { ...input, workspaceId }, credential: token }),
  });

  return { lines: [`${result.requestId}: ${result.status}`], result };
});

/** Reading evidence never restarts a completed request. */
export const runBoundedTurnShow = Effect.fn('runBoundedTurnShow')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'bounded-turn show'>): Effect.fn.Return<CommandResult<'bounded-turn show'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'showBoundedTurn', input: { ...input, workspaceId }, credential: token }),
  });

  return { lines: [`${result.requestId}: ${result.status}`], result };
});

/** The server owns cancellation across disconnects and repeated invocations. */
export const runBoundedTurnCancel = Effect.fn('runBoundedTurnCancel')(function* ({
  call,
  origin,
  input,
  credentials,
  selectedWorkspaceId,
}: RunInput<'bounded-turn cancel'>): Effect.fn.Return<CommandResult<'bounded-turn cancel'>, RunFailure> {
  const result = yield* withWorkspace({
    call,
    origin,
    credentials,
    selectedWorkspaceId,
    use: ({ token, workspaceId }) =>
      call({ name: 'cancelBoundedTurn', input: { ...input, workspaceId }, credential: token }),
  });

  return { lines: [`${result.requestId}: ${result.status}`], result };
});
