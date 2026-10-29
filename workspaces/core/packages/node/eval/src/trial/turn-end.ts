import { EventType, TurnStatus, UnknownEvent } from '@mechane/protocol';
import type { ListedEvent } from '@mechane/protocol';
import { Option, Schema } from 'effect';
import type { TurnEnd } from './types.ts';

type TurnEndInput = { readonly event: ListedEvent };

/**
 * The turn an event ends and how, none for an event that ends no turn. Only two events this release knows end a turn in
 * `/v1`, so an event of an unknown type ends none.
 */
export function turnEnd({ event }: TurnEndInput): Option.Option<TurnEnd> {
  if (Schema.is(UnknownEvent)(event)) {
    return Option.none();
  }

  switch (event.type) {
    case EventType.TurnAnswered:
      return Option.some({ turnId: event.turnId, outcome: { status: TurnStatus.Answered, reply: event.reply } });
    case EventType.TurnUnanswered:
      return Option.some({ turnId: event.turnId, outcome: { status: TurnStatus.Unanswered, reason: event.reason } });
    case EventType.InboxItemReceived:
    case EventType.InboxItemWritten:
    case EventType.TurnStarted:
    case EventType.TurnJoined:
    case EventType.TurnCanceled:
    case EventType.DroneStarted:
    case EventType.DroneReported:
    case EventType.DroneUnreported:
    case EventType.MechForked:
      return Option.none();
  }
}
