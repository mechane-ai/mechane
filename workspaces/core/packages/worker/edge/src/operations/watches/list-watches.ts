import { callMech } from '@mechane/bindings';
import { MechNotFound } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, WatchList } from '@mechane/protocol';
import { WatchesAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Reads saved watches from the addressed mech. */
export const listWatches = Effect.fn('listWatches')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listWatches>): Effect.fn.Return<WatchList, MechNotFound | ObjectUnavailable> {
  const { workspaceId, mechId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.watches(),
    answer: WatchesAnswer,
  });

  return yield* Match.valueTags(answer, {
    Listed: ({ watches }) => Effect.succeed({ watches }),
    MechMissing: () => new MechNotFound({ mechId }),
  });
});
