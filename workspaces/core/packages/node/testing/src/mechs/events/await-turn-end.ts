import type { ProcessFailed } from '@mechane/program';
import { Effect, Ref } from 'effect';
import type { CliFailed, CliUndecoded } from '../../errors.ts';
import { awaitEvent } from './await-event.ts';
import { turnEndAfter } from './turn-end-after.ts';
import type { EventFind, FollowerInput, TurnEndEvent } from './types.ts';

/** A wait for the next turn end, after the sequence of the last one the follower answered with. */
type AwaitTurnEndInput = FollowerInput & { readonly answered: Ref.Ref<number> };

/** Waits for the first turn end after the last one the follower answered with, and answers with it next. */
export const awaitTurnEnd = Effect.fn('awaitTurnEnd')(function* ({
  running,
  command,
  answered,
}: AwaitTurnEndInput): Effect.fn.Return<TurnEndEvent, CliFailed | CliUndecoded | ProcessFailed> {
  const last = yield* Ref.get(answered);
  const find: EventFind<TurnEndEvent> = ({ events }) => turnEndAfter({ events, last });
  const ended = yield* awaitEvent({ running, command, find });

  yield* Ref.set(answered, ended.sequence);

  return ended;
});
