import type { ProcessFailed, RunningProcess } from '@mechane/program';
import type { Event, EventType } from '@mechane/protocol';
import type { Effect, Option } from 'effect';
import type { CliFailed, CliUndecoded } from '../../errors.ts';

/** The types of event that end a turn. */
type TurnEndType = { readonly type: typeof EventType.TurnAnswered | typeof EventType.TurnUnanswered };

/** The event that ends a turn, with its reply or its reason for none. */
export type TurnEndEvent = Extract<Event, TurnEndType>;

/** The type of event that starts a turn. */
type TurnStartedType = { readonly type: typeof EventType.TurnStarted };

/** The event that starts a turn, with the items it took up. */
export type TurnStartedEvent = Extract<Event, TurnStartedType>;

/** The types of event that end a drone. */
type DroneEndType = { readonly type: typeof EventType.DroneReported | typeof EventType.DroneUnreported };

/** The event that ends a drone, with its report or its reason for none, and the item its mech received. */
export type DroneEndEvent = Extract<Event, DroneEndType>;

/** The drone whose end a follower waits for. */
export type DroneIdInput = { readonly droneId: string };

/** The inbox item whose turn's start a follower waits for. */
export type InboxItemIdInput = { readonly inboxItemId: string };

/** Why a follower's wait failed: its CLI exited first, wrote a record that does not decode, or the event was late. */
type FollowFailure = CliFailed | CliUndecoded | ProcessFailed;

/**
 * A follower of a mech's events. It waits for each next turn end, in the order the log holds them, the start of the
 * turn that took an item, and the end of a drone.
 */
export type EventFollower = {
  readonly awaitTurnEnd: () => Effect.Effect<TurnEndEvent, FollowFailure>;
  readonly awaitTurnStart: (input: InboxItemIdInput) => Effect.Effect<TurnStartedEvent, FollowFailure>;
  readonly awaitDroneEnd: (input: DroneIdInput) => Effect.Effect<DroneEndEvent, FollowFailure>;
};

/** The events the follower wrote, which a wait picks its event from. */
export type EventsInput = { readonly events: ReadonlyArray<Event> };

/** A wait's pick of the event it waits for among those the follower wrote, none while it has not come. */
export type EventFind<E> = (input: EventsInput) => Option.Option<E>;

/** A running follower, and its command as a failure names it. */
export type FollowerInput = { readonly running: RunningProcess; readonly command: string };
