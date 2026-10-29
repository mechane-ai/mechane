import { EventType } from '@mechane/protocol';
import { TurnId } from '@mechane/records';
import type { PlacedItemsInput } from '../types.ts';

/** Opens a turn for the items under a new id, with its event, and answers the id. */
export function startTurn({ store, inboxItemIds, now }: PlacedItemsInput): TurnId {
  const turnId = TurnId.make(crypto.randomUUID());

  store.openTurn({ turnId, inboxItemIds, now });
  store.appendEvent({ event: { type: EventType.TurnStarted, turnId, inboxItemIds }, now });

  return turnId;
}
