import type { ItemAnswered, ItemUnanswered } from '@mechane/harness';
import type { MechTables } from '@mechane/mech-store';
import { EventType, TurnStatus, UnansweredReason } from '@mechane/protocol';
import type { TurnId } from '@mechane/records';
import { Match, Option } from 'effect';
import type { DateTime } from 'effect';
import { enqueueSlackReplies } from '../slack/enqueue-slack-replies.ts';
import { startTurn } from './start-turn.ts';
import type { TurnEnding } from './types.ts';
import { unansweredEnding } from './unanswered-ending.ts';
import { unansweredReason } from './unanswered-reason.ts';

/** The tables a projection writes, the item whose turn ends, how pi ended it, and when. */
type EndItemTurnInput = {
  readonly store: MechTables;
  readonly inboxItemId: string;
  readonly progress: ItemAnswered | ItemUnanswered;
  readonly now: DateTime.Utc;
};

/** The tables that hold the turn's cancel and refusal, the turn, and how pi ended it. */
type TurnEndingInput = {
  readonly store: MechTables;
  readonly turnId: TurnId;
  readonly progress: ItemAnswered | ItemUnanswered;
};

/**
 * The longest reply a turn's event carries, in UTF-16 units: eight for each of an offer's most output tokens, so only a
 * reply degenerating into runs of whitespace is cut. Since `/v1` reads a reply as record text, a later deployment may
 * raise it up to a row's worth.
 */
const REPLY_MAX_CHARS = 524_288;

/**
 * Ends the item's running turn, which the projection starts first when pi ended the item before its placement was seen.
 * The ending transaction saves the turn's memory changes when it answered and discards them otherwise. Pi ends a run
 * only once every tool call of its round returned, so no change of the turn can land after this.
 */
export function endItemTurn({ store, inboxItemId, progress, now }: EndItemTurnInput): void {
  const turnId = Option.getOrElse(store.itemTurn({ inboxItemId }), () =>
    startTurn({ store, inboxItemIds: [inboxItemId], now }),
  );

  const { end, event } = turnEnding({ store, turnId, progress });

  if (Option.isNone(store.endTurn({ turnId, end, now }))) {
    return;
  }

  store.appendEvent({ event, now });

  if (event.type === EventType.TurnAnswered) {
    enqueueSlackReplies({ store, turnId, reply: event.reply, now });
  }

  switch (end.status) {
    case TurnStatus.Answered:
      return store.saveMemoryChanges({ turnId, now });
    case TurnStatus.Unanswered:
      return store.discardMemoryChanges({ turnId });
  }
}

/**
 * How the turn ends: a turn with a recorded cancel ends unanswered, canceled, whatever pi reports. A reply is cut to
 * its bound, with a character the cut splits replaced, so the event stays well formed.
 */
function turnEnding({ store, turnId, progress }: TurnEndingInput): TurnEnding {
  if (Option.isSome(store.turnCancel({ turnId }))) {
    return unansweredEnding({ turnId, reason: UnansweredReason.Canceled });
  }

  const answered: (ended: ItemAnswered) => TurnEnding = ({ reply }) => ({
    end: { status: TurnStatus.Answered },
    event: { type: EventType.TurnAnswered, turnId, reply: reply.slice(0, REPLY_MAX_CHARS).toWellFormed() },
  });

  const unanswered: (ended: ItemUnanswered) => TurnEnding = ({ failure }) =>
    unansweredEnding({
      turnId,
      reason: unansweredReason({ failure, isRefused: Option.isSome(store.turnRefusal({ turnId })) }),
    });

  return Match.valueTags(progress, { Answered: answered, Unanswered: unanswered });
}
