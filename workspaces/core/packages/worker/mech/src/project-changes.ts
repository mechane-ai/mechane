import type { ChangesInput } from '@mechane/harness';
import { EventType } from '@mechane/protocol';
import { Match, Option } from 'effect';
import { briefEnding } from './drones/brief-ending.ts';
import { endDrone } from './drones/end-drone.ts';
import { writeSilentItem } from './inbox/write-silent-item.ts';
import { endItemTurn } from './turns/end-item-turn.ts';
import { startTurn } from './turns/start-turn.ts';
import type { NowInput, PlacedItemsInput, ProgressTest, TablesInput } from './types.ts';

/** What one pi commit or a catch-up moved, the tables a projection writes, and when. */
type ProjectChangesInput = ChangesInput & ProjectionInput;

/** The tables a projection writes, and when. */
type ProjectionInput = TablesInput & NowInput;

/** One inbox item's progress, as one pi commit or a catch-up reports it. */
type ItemChange = ChangesInput['changes'][number];

/** Whether an item's progress places it into a turn. */
const IS_PLACED: Readonly<ProgressTest> = {
  Placed: () => true,
  Answered: () => false,
  Unanswered: () => false,
  Written: () => false,
};

/**
 * Moves the inbox items and the drones one pi commit took forward, with the events that report each step, in one
 * transaction. Ends apply before placements, which pi commits in no stated order, and the ends of items whose turn is
 * recorded apply first, since pi placed every other item after them. A step already taken writes nothing, since the
 * commit listener and the catch-up can report the same one.
 */
export function projectChanges({ store, changes, droneEnds, now }: ProjectChangesInput): void {
  const isRecorded: (change: ItemChange) => boolean = ({ inboxItemId }) =>
    Option.isSome(store.itemTurn({ inboxItemId }));

  // Ending these first ends the running turn before an item whose placement was never seen opens its own turn, since
  // the schema holds at most one running turn.
  const recorded = changes.filter(isRecorded);
  const isUnrecorded: (change: ItemChange) => boolean = (change) => !recorded.includes(change);
  const ordered = [...recorded, ...changes.filter(isUnrecorded)];

  for (const { droneId, progress } of droneEnds) {
    endDrone({ store, droneId, ending: briefEnding({ store, droneId, progress }), now });
  }

  for (const { inboxItemId, progress } of ordered) {
    Match.valueTags(progress, {
      Placed: () => undefined,
      Answered: (ended) => endItemTurn({ store, inboxItemId, progress: ended, now }),
      Unanswered: (ended) => endItemTurn({ store, inboxItemId, progress: ended, now }),
      Written: () => writeSilentItem({ store, inboxItemId, now }),
    });
  }

  const isWaiting: (change: ItemChange) => boolean = ({ inboxItemId, progress }) =>
    Match.valueTags(progress, IS_PLACED) && Option.isNone(store.itemTurn({ inboxItemId }));

  const waiting = ordered.filter(isWaiting).map(({ inboxItemId }) => inboxItemId);

  if (waiting.length > 0) {
    placeItems({ store, inboxItemIds: waiting, now });
  }
}

/**
 * Places items in the turn still running once the commit's ends applied: pi places a steer at a pause between the
 * turn's model requests, where it joins the turn. With no turn running, the items start one of their own.
 */
function placeItems({ store, inboxItemIds, now }: PlacedItemsInput): void {
  const running = store.runningTurn();

  if (Option.isNone(running)) {
    startTurn({ store, inboxItemIds, now });

    return;
  }

  const turnId = running.value;

  for (const inboxItemId of inboxItemIds) {
    store.joinTurn({ turnId, inboxItemId });
    store.appendEvent({ event: { type: EventType.TurnJoined, turnId, inboxItemId }, now });
  }
}
