import { callMech, callWorkspace } from '@mechane/bindings';
import { MechNotFound, TurnNotFound } from '@mechane/protocol';
import type { catalog, ObjectUnavailable, Trace } from '@mechane/protocol';
import { TurnAnswer, WorkDispatchesAnswer } from '@mechane/rpc';
import { Effect, Match, Option } from 'effect';
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

  const detail = yield* Match.valueTags(answer, {
    Found: (found) => Effect.succeed(found),
    MechMissing: () => new MechNotFound({ mechId }),
    TurnMissing: () => new TurnNotFound({ turnId }),
  });

  const dispatches = yield* callWorkspace({
    settings,
    workspaceId,
    call: ({ workspace }) => workspace.workDispatches({ mechId, workId: turnId }),
    answer: WorkDispatchesAnswer,
  });

  const tools = Option.fromNullishOr(detail.toolCalls);
  const notices = Option.fromNullishOr(detail.evidenceNotices);

  return {
    turn: detail.turn,
    replyExcerpt: detail.replyExcerpt,
    dispatches,
    toolCalls: Option.getOrElse(tools, () => []),
    evidenceNotices: Option.getOrElse(notices, () => ['Tool evidence is unavailable from this runtime.']),
  };
});
