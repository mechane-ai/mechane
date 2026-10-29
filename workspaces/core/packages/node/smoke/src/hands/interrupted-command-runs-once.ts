import { Delivery, EventType } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import { check, commandGate, followEvents, LOG_START, signedInMech, turnOutcome } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Effect } from 'effect';
import type { Scope } from 'effect';
import { awaitHandOff } from './await-hand-off.ts';
import { HELD_REPLY } from './constants.ts';
import { handOffEachSecond } from './hand-off-each-second.ts';
import { heldTurn } from './held-turn.ts';

/** What the gated command prints once the gate opens, which the mech's reply must hold. */
const GATE_RELEASED = 'released';

/**
 * Kills celld while a mech's gated command runs, and starts it again with alarms that hand pi on each second, where a
 * new follower's call reopens the object. Once an alarm has handed pi on and the gate opens, the turn must answer with
 * the command's output, from the one run the gate counted. A reply streaming across hand-offs must then answer once, on
 * one dispatch settled at its usage, and a last restart restores the stack's variables however the scenario ends.
 */
export const interruptedCommandRunsOnce = Effect.fn('interruptedCommandRunsOnce')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const gate = yield* commandGate({ stack });

  yield* mech.send({ text: `${COMMAND_PREFIX}${gate.bash} && echo ${GATE_RELEASED}`, delivery: Delivery.WhenIdle });
  yield* gate.awaitRun;
  yield* handOffEachSecond({ stack });

  const follower = yield* followEvents({ stack, account: mech.account, mechId: mech.id, after: LOG_START });

  yield* awaitHandOff({ stack, mech });
  yield* gate.open;

  const ended = yield* follower.awaitTurnEnd();
  const runs = yield* gate.runs;
  const held = yield* heldTurn({ mech, follower });

  yield* check({
    name: guarantee,
    conditions: [
      ended.type === EventType.TurnAnswered && ended.reply.includes(GATE_RELEASED),
      runs === 1,
      held.ended.type === EventType.TurnAnswered && held.ended.reply === HELD_REPLY,
      held.dispatches === 1,
      held.settledAtUsage === 1,
    ],
    detail: `the turn ended ${turnOutcome({ ended })}, and the gated command ran ${runs} times; the held turn ended ${turnOutcome({ ended: held.ended })} on ${held.dispatches} dispatches, ${held.settledAtUsage} settled at their usage`,
  });
}, Effect.scoped);
