import { Delivery, TurnCancel } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import type { Stack } from '@mechane/stack';
import { commandGate, ScriptedTool, TEXT_BYTES, toolCallLine } from '@mechane/testing';
import type { CommandGate, ScenarioFailure, TalkingMech, TurnEndEvent } from '@mechane/testing';
import { DateTime, Effect } from 'effect';
import { randomBytes } from 'node:crypto';
import { ScenarioPath } from './constants.ts';
import { memoryPaths } from './memory-paths.ts';

/** The scenario's mech, which its CLI calls name. */
type MemberCanceledTurnInput = { readonly stack: Stack; readonly mech: TalkingMech };

/**
 * What a member's cancel showed: the draft the canceled turn wrote, the paths saved while it ran, and the turn its item
 * started. It also holds the times both cancels answered, that turn's end, and the gate the item queued behind it waits
 * at.
 */
type MemberCanceledTurn = {
  readonly draft: string;
  readonly pending: ReadonlyArray<string>;
  readonly startedTurnId: string;
  readonly cancelTimes: ReadonlyArray<string>;
  readonly canceled: TurnEndEvent;
  readonly queued: CommandGate;
};

/**
 * Sends an item that writes the draft and waits at a gate, and an item queued behind it. Once the gate runs, cancels
 * the first item's turn twice, follows it to its end, and waits for the second item's gate.
 */
export const memberCanceledTurn = Effect.fn('memberCanceledTurn')(function* ({
  stack,
  mech,
}: MemberCanceledTurnInput): Effect.fn.Return<MemberCanceledTurn, ScenarioFailure> {
  const draft = `draft ${randomBytes(TEXT_BYTES).toString('hex')}`;
  const drafting = yield* commandGate({ stack });
  const queued = yield* commandGate({ stack });
  const write = toolCallLine({ tool: ScriptedTool.MemoryWrite, input: { path: ScenarioPath.Draft, text: draft } });
  const sent = yield* mech.send({ text: `${write}\n${COMMAND_PREFIX}${drafting.bash}`, delivery: Delivery.WhenIdle });

  yield* mech.send({ text: `${COMMAND_PREFIX}${queued.bash}`, delivery: Delivery.WhenIdle });
  yield* drafting.awaitRun;

  const pending = yield* memoryPaths({ mech });
  const started = yield* mech.follower.awaitTurnStart({ inboxItemId: sent.id });
  const turnCancel = { words: ['turn', 'cancel'], ids: [started.turnId], result: TurnCancel };
  const first = yield* mech.command(turnCancel);
  const retried = yield* mech.command(turnCancel);
  const canceled = yield* mech.follower.awaitTurnEnd();

  yield* queued.awaitRun;
  yield* drafting.open;

  const cancelTimes = [first, retried].map((cancel) => DateTime.formatIso(cancel.canceledAt));

  return { draft, pending, startedTurnId: started.turnId, cancelTimes, canceled, queued };
});
