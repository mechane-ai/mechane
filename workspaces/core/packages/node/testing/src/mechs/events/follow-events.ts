import { Effect, Ref } from 'effect';
import type { Scope } from 'effect';
import { followCli } from '../../cli/follow-cli.ts';
import type { FollowEventsInput } from '../types.ts';
import { awaitEvent } from './await-event.ts';
import { awaitTurnEnd } from './await-turn-end.ts';
import { droneEnd } from './drone-end.ts';
import { itemTurnStart } from './item-turn-start.ts';
import type { EventFollower } from './types.ts';

/**
 * Follows a mech's events after a sequence through `mechane event list --follow`, as an agent would, until the scope
 * closes. Each wait reads only the JSON Lines the follower wrote, and fails when it exits first or its event is late.
 * Turn ends come one after another, in the order the log holds them.
 */
export const followEvents = Effect.fn('followEvents')(function* ({
  stack,
  account,
  mechId,
  after,
}: FollowEventsInput): Effect.fn.Return<EventFollower, never, Scope.Scope> {
  const args = ['event', 'list', mechId, '--follow', '--after', String(after)];
  const running = yield* followCli({ stack, args, environment: account.environment });
  const answered = yield* Ref.make(after);
  const command = args.join(' ');
  const nextTurnEnd: EventFollower['awaitTurnEnd'] = () => awaitTurnEnd({ running, command, answered });

  const turnStart: EventFollower['awaitTurnStart'] = ({ inboxItemId }) =>
    awaitEvent({ running, command, find: ({ events }) => itemTurnStart({ events, inboxItemId }) });

  const end: EventFollower['awaitDroneEnd'] = ({ droneId }) =>
    awaitEvent({ running, command, find: ({ events }) => droneEnd({ events, droneId }) });

  return { awaitTurnEnd: nextTurnEnd, awaitTurnStart: turnStart, awaitDroneEnd: end };
});
