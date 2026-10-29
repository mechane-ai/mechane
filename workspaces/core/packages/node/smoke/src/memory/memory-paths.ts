import { MemoryList } from '@mechane/protocol';
import type { ScenarioFailure, TalkingMech } from '@mechane/testing';
import { Effect } from 'effect';

/** The mech whose memories to list. */
type MemoryPathsInput = { readonly mech: TalkingMech };

/** The paths of the memories `mechane memory list` shows, which only a turn's reply saves. */
export const memoryPaths = Effect.fn('memoryPaths')(function* ({
  mech,
}: MemoryPathsInput): Effect.fn.Return<ReadonlyArray<string>, ScenarioFailure> {
  const { memories } = yield* mech.command({ words: ['memory', 'list'], ids: [], result: MemoryList });

  return memories.map((memory) => memory.path);
});
