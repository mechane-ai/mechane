import { EventType } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import { talkingMech } from '@mechane/testing';
import type { ScenarioFailure } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { Sentinel } from './constants.ts';
import type { AccountInput } from './types.ts';

/** Gives a mech the sentinel text and then the sentinel command, and tells whether the command's output came back. */
export const sentinelTurns = Effect.fn('sentinelTurns')(function* ({
  stack,
  account,
}: AccountInput): Effect.fn.Return<boolean, ScenarioFailure, Scope.Scope> {
  const mech = yield* talkingMech({ stack, account, model: stack.modelUpstream.offers.echo.id });

  yield* mech.turn({ text: Sentinel.Text });

  const { ended } = yield* mech.turn({ text: `${COMMAND_PREFIX}echo ${Sentinel.Command}` });

  return ended.type === EventType.TurnAnswered && ended.reply.includes(Sentinel.Command);
}, Effect.scoped);
