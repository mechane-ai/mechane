import { callMech, callWorkspace } from '@mechane/bindings';
import { MechNotFound, TurnNotFound } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, Trace } from '@mechane/protocol';
import { TurnAnswer, WorkDispatchesAnswer } from '@mechane/rpc';
import { Effect, Match } from 'effect';
import type { WorkInput } from '../../routing/types.ts';

/** Joins a turn, which the mech keeps, with its dispatches, which the workspace's ledger keeps. */
export const showTurn = Effect.fn('showTurn')(function* ({
  input,
  settings,
}: WorkInput<typeof catalog.showTurn>): Effect.fn.Return<Trace, MechNotFound | TurnNotFound | ObjectUnavailable> {
  const { workspaceId, mechId, turnId } = input;

  const answer = yield* callMech({
    settings,
    workspaceId,
    mechId,
    call: ({ mech }) => mech.turn({ turnId }),
    answer: TurnAnswer,
  });

  const turn = yield* Match.valueTags(answer, {
    Found: (found) => Effect.succeed(found.turn),
    MechMissing: () => new MechNotFound({ mechId }),
    TurnMissing: () => new TurnNotFound({ turnId }),
  });

  const dispatches = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.workDispatches({ mechId, workId: turnId }),
    answer: WorkDispatchesAnswer,
  });

  return { turn, dispatches };
});
