import type { BetaManagedAgentsSessionEvent } from '@anthropic-ai/sdk/resources/beta/sessions/events';
import { Array, Effect, Option, Record, Stream } from 'effect';
import type { Scope } from 'effect';
import type { RoleReceipt } from '../application-schemas.ts';
import type { RoleContext } from '../application-types.ts';
import type { EvalAdapterFailed } from '../errors.ts';
import { managedFailure } from '../managed-request.ts';

type ReadEvents = { readonly context: RoleContext; readonly sessionId: RoleReceipt['sessionId'] };
type RoleHistory = { readonly events: ReadonlyArray<BetaManagedAgentsSessionEvent> };

const EventType = {
  Message: 'user.message',
  Interrupt: 'user.interrupt',
  ToolResult: 'user.custom_tool_result',
  Running: 'session.status_running',
  Rescheduled: 'session.status_rescheduled',
  Idle: 'session.status_idle',
  Terminated: 'session.status_terminated',
} as const satisfies Readonly<Record<string, BetaManagedAgentsSessionEvent['type']>>;

const StopReason = { RequiresAction: 'requires_action', Interrupted: 'interrupted', Terminated: 'terminated' } as const;
const eventTypes = Record.values(EventType);
const lifecycleEvents: ReadonlySet<string> = new Set(eventTypes);
const userCommands: ReadonlySet<string> = new Set([EventType.Message, EventType.Interrupt]);
const PAGE_EVENTS = 100;

export const roleEvents = Effect.fn('roleEvents')(function* ({
  context,
  sessionId,
}: ReadEvents): Effect.fn.Return<ReadonlyArray<BetaManagedAgentsSessionEvent>, EvalAdapterFailed, Scope.Scope> {
  const signal = yield* Effect.abortSignal;

  const pages = context.target.managed.beta.sessions.events.list(
    sessionId,
    { order: 'asc', limit: PAGE_EVENTS },
    { signal },
  );

  const stream = Stream.fromAsyncIterable(pages, (cause) =>
    managedFailure({ action: 'Read eval session events', cause }),
  );

  return yield* Stream.runCollect(stream);
}, Effect.scoped);

/** An interrupt acknowledged by a terminal idle event ends the role even if the idle reason also says end_turn. */
export function terminalReason({ events }: RoleHistory): Option.Option<string> {
  const last = Array.findLast(events, (event) => lifecycleEvents.has(event.type));

  if (Option.isNone(last)) {
    return Option.none();
  }

  const status = last.value;
  const command = Array.findLast(events, (event) => userCommands.has(event.type));
  const wasInterrupted = Option.exists(command, (event) => event.type === EventType.Interrupt);

  if (status.type === EventType.Terminated) {
    if (wasInterrupted) {
      return Option.some(StopReason.Interrupted);
    }

    return Option.some(StopReason.Terminated);
  }

  if (status.type !== EventType.Idle || status.stop_reason.type === StopReason.RequiresAction) {
    return Option.none();
  }

  if (!events.some((event) => event.type === EventType.Message)) {
    return Option.none();
  }

  if (wasInterrupted) {
    return Option.some(StopReason.Interrupted);
  }

  return Option.some(status.stop_reason.type);
}
