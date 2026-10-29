import { KnownTrace } from '@mechane/program';
import { Delivery, DispatchStatus, SettlementBasis } from '@mechane/protocol';
import { HOLD_PREFIX, REPLY_PREFIX } from '@mechane/stack';
import type { EventFollower, ScenarioFailure, TalkingMech, TurnEndEvent } from '@mechane/testing';
import { Duration, Effect } from 'effect';
import { HELD_REPLY } from './constants.ts';

/** How long the upstream holds the held reply's stream open: across several hand-offs. */
const HOLD = Duration.seconds(3);

/** The mech that gets the held reply, and the follower that reads its turn's end. */
type HeldTurnInput = { readonly mech: TalkingMech; readonly follower: EventFollower };

/** How the held reply's turn ended, how many dispatches its trace holds, and how many of them settled at usage. */
type HeldTurn = { readonly ended: TurnEndEvent; readonly dispatches: number; readonly settledAtUsage: number };

/**
 * Sends the mech a reply the upstream streams across several hand-offs, follows its turn's end, and counts the
 * dispatches its trace holds and those settled at their usage.
 */
export const heldTurn = Effect.fn('heldTurn')(function* ({
  mech,
  follower,
}: HeldTurnInput): Effect.fn.Return<HeldTurn, ScenarioFailure> {
  yield* mech.send({
    text: `${HOLD_PREFIX}${Duration.toMillis(HOLD)}\n${REPLY_PREFIX}${HELD_REPLY}`,
    delivery: Delivery.WhenIdle,
  });

  const ended = yield* follower.awaitTurnEnd();
  const { dispatches } = yield* mech.command({ words: ['turn', 'show'], ids: [ended.turnId], result: KnownTrace });

  const usage = dispatches.filter(
    (dispatch) => dispatch.status === DispatchStatus.Settled && dispatch.basis === SettlementBasis.Usage,
  );

  return { ended, dispatches: dispatches.length, settledAtUsage: usage.length };
});
