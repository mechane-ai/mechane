import { callMech } from '@mechane/bindings';
import { MechNotFound, WatchNotFound } from '@mechane/protocol';
import type { catalog, FindingList, ObjectUnavailable } from '@mechane/protocol';
import { FindingsAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Reads findings from the addressed mech and translates missing resources into API failures. */
export const listFindings = Effect.fn('listFindings')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.listFindings>): Effect.fn.Return<
  FindingList,
  MechNotFound | WatchNotFound | ObjectUnavailable
> {
  const { workspaceId, mechId, watchId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.findings({ watchId }),
    answer: FindingsAnswer,
  });

  return yield* Match.valueTags(answer, {
    Listed: ({ findings }) => Effect.succeed({ findings }),
    MechMissing: () => new MechNotFound({ mechId }),
    WatchMissing: () => new WatchNotFound({ watchId }),
  });
});
