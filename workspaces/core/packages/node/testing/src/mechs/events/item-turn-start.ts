import { EventType } from '@mechane/protocol';
import { Array } from 'effect';
import type { Option } from 'effect';
import type { EventsInput, InboxItemIdInput, TurnStartedEvent } from './types.ts';

/** The events the follower wrote, and the item whose turn's start to pick. */
type ItemTurnStartInput = EventsInput & InboxItemIdInput;

/** The start of the turn that took the item, none while it has not come. */
export function itemTurnStart({ events, inboxItemId }: ItemTurnStartInput): Option.Option<TurnStartedEvent> {
  return Array.findFirst(
    events.filter((event) => event.type === EventType.TurnStarted),
    (event) => event.inboxItemIds.includes(inboxItemId),
  );
}
