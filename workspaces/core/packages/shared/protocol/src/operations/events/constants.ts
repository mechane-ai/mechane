import { Duration } from 'effect';

/** The kinds of event a mech's log records, each named for the record it reports and the change. */
export const EventType = {
  NotificationReceived: 'notification.received',
  ActivationStarted: 'activation.started',
  ActivationCompleted: 'activation.completed',
  ActivationFailed: 'activation.failed',
  ActivationStopped: 'activation.stopped',
  ConsoleMessage: 'console.message',
  InboxItemReceived: 'inbox_item.received',
  TurnStarted: 'turn.started',
  TurnCanceled: 'turn.canceled',
  TurnAnswered: 'turn.answered',
  TurnUnanswered: 'turn.unanswered',
  MechForked: 'mech.forked',
} as const;

export type EventType = (typeof EventType)[keyof typeof EventType];

/**
 * The longest a list of events waits for an event after its cursor: below the CLI's 30-second request timeout, so a
 * wait never times the client out.
 */
export const WAIT_MAX = Duration.seconds(20);
