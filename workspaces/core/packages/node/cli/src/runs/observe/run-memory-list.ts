import type { CommandResult, RunFailure, RunInput } from '@mechane/cli-kernel';
import { Effect } from 'effect';
import { withWorkspace } from '../mechs/with-workspace.ts';
import { memoryLines } from './memory-lines.ts';

/** Lists the memories a mech saved, by path, each with its text. */
export const runMemoryList = Effect.fn('runMemoryList')(function* ({
  call,
  origin,
  input,
  credentials,
}: RunInput<'memory list'>): Effect.fn.Return<CommandResult<'memory list'>, RunFailure> {
  const list = yield* withWorkspace({
    call,
    origin,
    credentials,
    use: ({ token, workspaceId }) =>
      call({ name: 'listMemories', input: { ...input, workspaceId }, credential: token }),
  });

  return { lines: list.memories.flatMap((memory) => memoryLines({ memory })), result: list };
});
