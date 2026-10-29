import { EventType, UnknownEvent } from '@mechane/protocol';
import type { ListedEvent } from '@mechane/protocol';
import { DateTime, Schema } from 'effect';
import { UNKNOWN_KIND_NOTE } from '../constants.ts';
import { indentedText } from './indented-text.ts';

type EventLinesInput = { readonly event: ListedEvent };

/**
 * One event as a person reads it: its sequence, time, type and subject, then the text it carries, indented. An event of
 * a type this release does not know shows only the first three.
 */
export function eventLines({ event }: EventLinesInput): ReadonlyArray<string> {
  if (Schema.is(UnknownEvent)(event)) {
    return [`#${event.sequence} ${DateTime.formatIso(event.occurred_at)} ${event.type}, ${UNKNOWN_KIND_NOTE}`];
  }

  const heading = `#${event.sequence} ${DateTime.formatIso(event.occurredAt)} ${event.type}`;

  switch (event.type) {
    case EventType.InboxItemReceived:
      return [`${heading} ${event.inboxItemId} from ${event.senderId}, ${event.delivery}`, ...indentedText(event)];
    case EventType.InboxItemWritten:
      return [`${heading} ${event.inboxItemId}`];
    case EventType.TurnStarted:
      return [`${heading} ${event.turnId} for ${event.inboxItemIds.join(', ')}`];
    case EventType.TurnJoined:
      return [`${heading} ${event.turnId} took ${event.inboxItemId}`];
    case EventType.TurnCanceled:
      return [`${heading} ${event.turnId} by ${event.cancelerId}`];
    case EventType.TurnAnswered:
      return [`${heading} ${event.turnId}`, ...indentedText({ text: event.reply })];
    case EventType.TurnUnanswered:
      return [`${heading} ${event.turnId} (${event.reason})`];
    case EventType.DroneStarted:
      return [`${heading} ${event.droneId} on thread ${event.threadId}`];
    case EventType.DroneReported:
      return [`${heading} ${event.droneId} as ${event.inboxItemId}`, ...indentedText({ text: event.report })];
    case EventType.DroneUnreported:
      return [`${heading} ${event.droneId} (${event.reason}) as ${event.inboxItemId}`];
    case EventType.MechForked:
      return [`${heading} from ${event.forkedFrom.mechId} after #${event.forkedFrom.sequence}`];
  }
}
