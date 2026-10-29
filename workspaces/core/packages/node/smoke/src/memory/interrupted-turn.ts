import { Delivery } from '@mechane/protocol';
import { ScriptedTool, TEXT_BYTES, toolCallLine } from '@mechane/testing';
import type { CommandGate, ScenarioFailure, TalkingMech, TurnEndEvent } from '@mechane/testing';
import { Effect } from 'effect';
import { randomBytes } from 'node:crypto';
import { ScenarioPath } from './constants.ts';
import { memoryPaths } from './memory-paths.ts';

/** The scenario's mech, and the gate the turn an interrupt cancels waits at. */
type InterruptedTurnInput = { readonly mech: TalkingMech; readonly queued: CommandGate };

/** What an interrupt showed: the end of the turn it canceled, the end of its own, and the paths saved after. */
type InterruptedTurn = {
  readonly cut: TurnEndEvent;
  readonly answered: TurnEndEvent;
  readonly saved: ReadonlyArray<string>;
};

/**
 * Sends an interrupt item that writes a memory and reads the draft while the queued item's turn waits at its gate, and
 * follows both turns to their ends.
 */
export const interruptedTurn = Effect.fn('interruptedTurn')(function* ({
  mech,
  queued,
}: InterruptedTurnInput): Effect.fn.Return<InterruptedTurn, ScenarioFailure> {
  const kept = `kept ${randomBytes(TEXT_BYTES).toString('hex')}`;
  const write = toolCallLine({ tool: ScriptedTool.MemoryWrite, input: { path: ScenarioPath.Kept, text: kept } });
  const read = toolCallLine({ tool: ScriptedTool.MemoryRead, input: { path: ScenarioPath.Draft } });

  yield* mech.send({ text: `${write}\n${read}`, delivery: Delivery.Interrupt });

  const cut = yield* mech.follower.awaitTurnEnd();
  const answered = yield* mech.follower.awaitTurnEnd();

  yield* queued.open;

  return { cut, answered, saved: yield* memoryPaths({ mech }) };
});
