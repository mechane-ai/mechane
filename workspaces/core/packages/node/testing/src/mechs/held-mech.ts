import { Effect } from 'effect';
import type { Scope } from 'effect';
import { followEvents } from './events/follow-events.ts';
import { loggedEvents } from './events/logged-events.ts';
import { mechCommand } from './mech-command.ts';
import { mechTurn } from './mech-turn.ts';
import { sentItem } from './sent-item.ts';
import type { FollowEventsInput, TalkingMech } from './types.ts';

/**
 * A mech of the account by its id, whose follower starts before any send, so it misses no event a send causes. The
 * follower reads from after `after` and stops when the scope closes. A command runs a CLI command on the mech and
 * decodes its result, and a log read lists its events once.
 */
export const heldMech = Effect.fn('heldMech')(function* ({
  stack,
  account,
  mechId,
  after,
}: FollowEventsInput): Effect.fn.Return<TalkingMech, never, Scope.Scope> {
  const follower = yield* followEvents({ stack, account, mechId, after });
  const turn: TalkingMech['turn'] = ({ text }) => mechTurn({ stack, account, mechId, follower, text });

  const send: TalkingMech['send'] = ({ text, delivery }) =>
    sentItem({ stack, account, mechId, args: [text, '--delivery', delivery] });

  const resend: TalkingMech['resend'] = ({ text, inboxItemId }) =>
    sentItem({ stack, account, mechId, args: [text, '--inbox-item-id', inboxItemId] });

  const command: TalkingMech['command'] = ({ words, ids, result }) =>
    mechCommand({ stack, account, mechId, words, ids, result });

  const logged: TalkingMech['logged'] = ({ after: from }) => loggedEvents({ stack, account, mechId, after: from });

  return { id: mechId, account, follower, turn, send, resend, command, logged };
});
