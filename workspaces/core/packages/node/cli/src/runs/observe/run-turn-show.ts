import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { traceLines } from './trace-lines.ts';

/** Shows one turn of a mech: its outcome, and each model request it reserved, with its tokens and charge. */
export const runTurnShow = Effect.fn('runTurnShow')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'turn show'>): Effect.fn.Return<CommandResult<'turn show'>, RunFailure> {
  const trace = yield* withWorkspace({
    call,
    origin,
    credentials,
    use: ({ token, workspaceId }) => call({ name: 'showTurn', input: { ...input, workspaceId }, credential: token }),
  });

  return { lines: traceLines({ trace }), result: trace };
});
