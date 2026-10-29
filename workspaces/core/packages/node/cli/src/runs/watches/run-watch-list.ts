import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { watchLine } from './watch-line.ts';

/** Lists the saved schedules and latest check outcomes for a mech. */
export const runWatchList = Effect.fn('runWatchList')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'watch list'>): Effect.fn.Return<CommandResult<'watch list'>, RunFailure> {
  const list = yield* withWorkspace({
    call,
    origin,
    credentials,
    use: ({ token, workspaceId }) => call({ name: 'listWatches', input: { ...input, workspaceId }, credential: token }),
  });

  return { lines: list.watches.map((watch) => watchLine({ watch })), result: list };
});
