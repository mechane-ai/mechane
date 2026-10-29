import { KnownTrace } from '@mechane/program';
import { Effect } from 'effect';
import { runCli } from '../cli/run-cli.ts';
import type { ScenarioFailure } from '../types.ts';
import type { EventFollower } from './events/types.ts';
import { sentItem } from './sent-item.ts';
import type { MechInput, MechTurn, TextInput } from './types.ts';

/** A turn to start with text, through the account's CLI and the mech's follower. */
type TurnInput = MechInput & TextInput & FollowerInput;

/** The follower of a mech's events. */
type FollowerInput = { readonly follower: EventFollower };

/**
 * Sends the text, follows the turn the item starts to its end, and reads its trace, with the requests the upstream
 * received meanwhile.
 */
export const mechTurn = Effect.fn('mechTurn')(function* ({
  stack,
  account,
  mechId,
  follower,
  text,
}: TurnInput): Effect.fn.Return<MechTurn, ScenarioFailure> {
  const before = stack.modelUpstream.requests().length;
  const sent = yield* sentItem({ stack, account, mechId, args: [text] });
  const ended = yield* follower.awaitTurnEnd();
  const requests = stack.modelUpstream.requests().slice(before);
  const args = ['turn', 'show', mechId, ended.turnId];
  const { result: trace } = yield* runCli({ stack, args, environment: account.environment, result: KnownTrace });

  return { sent, ended, requests, trace };
});
