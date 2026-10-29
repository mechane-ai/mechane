import { callMech } from '@mechane/bindings';
import { MechNotFound } from '@mechane/protocol';
import type { catalog, MemoryList, ObjectUnavailable } from '@mechane/protocol';
import { MemoriesAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Lists the memories the mech's turns saved, which its object reads in one transaction without calling pi. */
export const listMemories = Effect.fn('listMemories')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listMemories>): Effect.fn.Return<MemoryList, MechNotFound | ObjectUnavailable> {
  const { workspaceId, mechId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.memories(),
    answer: MemoriesAnswer,
  });

  return yield* Match.valueTags(answer, {
    Listed: ({ memories }) => Effect.succeed({ memories }),
    MechMissing: () => new MechNotFound({ mechId }),
  });
});
