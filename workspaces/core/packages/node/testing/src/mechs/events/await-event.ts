import type { ProcessFailed } from '@mechane/program';
import type { Event } from '@mechane/protocol';
import { Duration, Effect, Option } from 'effect';
import { exitedFirst } from '../../cli/exited-first.ts';
import { CliStep } from '../../constants.ts';
import { CliFailed } from '../../errors.ts';
import type { CliUndecoded } from '../../errors.ts';
import { followedEvents } from './followed-events.ts';
import type { EventFind, FollowerInput } from './types.ts';

/** A wait for an event the follower writes, and the pick of the event it waits for. */
type AwaitEventInput<E> = FollowerInput & { readonly find: EventFind<E> };

/** How often a scenario reads a follower's standard output for the event it waits for. */
const EVENT_POLL_INTERVAL = Duration.millis(100);

/**
 * How long a scenario waits for an event it expects: far past any turn or drone of the scripted model. An event that
 * never comes then fails its scenario instead of holding the smoke.
 */
const EVENT_WAIT_TIMEOUT = Duration.minutes(1);

/**
 * Waits for the event the find picks out of what the follower wrote, and fails when the follower exits first or the
 * event does not come in time.
 */
export const awaitEvent = Effect.fn('awaitEvent')(function* <E extends Event>({
  running,
  command,
  find,
}: AwaitEventInput<E>): Effect.fn.Return<E, CliFailed | CliUndecoded | ProcessFailed> {
  const exited = exitedFirst({ running, command, step: CliStep.Follow });

  const found = yield* Effect.raceFirst(nextEvent({ running, command, find }), exited).pipe(
    Effect.timeoutOption(EVENT_WAIT_TIMEOUT),
  );

  if (Option.isNone(found)) {
    return yield* new CliFailed({ command, step: CliStep.Await, status: Option.none(), stderr: running.stderr() });
  }

  return found.value;
});

/** Reads the follower's events each poll interval until the find picks one. */
const nextEvent = Effect.fn('nextEvent')(function* <E extends Event>({
  running,
  command,
  find,
}: AwaitEventInput<E>): Effect.fn.Return<E, CliUndecoded> {
  const events = yield* followedEvents({ running, command });
  const found = find({ events });

  if (Option.isSome(found)) {
    return found.value;
  }

  yield* Effect.sleep(EVENT_POLL_INTERVAL);

  return yield* nextEvent({ running, command, find });
});
