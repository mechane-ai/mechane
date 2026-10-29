import { Delivery, EventType } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import {
  check,
  followEvents,
  ScriptedTool,
  signedInMech,
  TEXT_BYTES,
  toolCallLine,
  turnOutcome,
} from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput, TalkingMech, TurnEndEvent } from '@mechane/testing';
import { Array, Effect, Option } from 'effect';
import type { Scope } from 'effect';
import { randomBytes } from 'node:crypto';
import { ScenarioPath } from './constants.ts';

/** A mech whose events a new follower reads after `after`, the last sequence the scenario saw before the restart. */
type RecallAfterRestartInput = { readonly stack: Stack; readonly mech: TalkingMech; readonly after: number };

/** The first line of the memory to recall, which the memory section shows as its summary; its random line follows. */
const MEMORY_SUMMARY = 'The launch plan';

/** The note a handoff starts the mech's fresh context from; it names nothing the mech saved. */
const HANDOFF_NOTE = 'Your earlier context was cleared; your memory section lists what you saved.';

/** The end of the read's turn, and the body of the first request it sent. */
type RecallAfterRestart = {
  readonly recalled: TurnEndEvent;
  /** The body of the read's first request, none when the read sent the upstream no request. */
  readonly firstBody: Option.Option<string>;
};

/**
 * In one turn a mech saves a memory and hands off to a fresh context, the deployment restarts, and then the mech reads
 * the memory. The read's reply holds the memory's random line, and the first request after the restart holds the
 * memory's summary, which only the memory section shows. That request holds the random line nowhere, so the handoff
 * left no earlier message, and the read found the memory in storage, not the transcript.
 */
export const savedMemoryOutlivesARestartAndAReset = Effect.fn('savedMemoryOutlivesARestartAndAReset')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const line = `remembered ${randomBytes(TEXT_BYTES).toString('hex')}`;
  const memory = { path: ScenarioPath.Recalled, text: `${MEMORY_SUMMARY}\n${line}` };
  const write = toolCallLine({ tool: ScriptedTool.MemoryWrite, input: memory });
  const handoff = toolCallLine({ tool: ScriptedTool.Handoff, input: { note: HANDOFF_NOTE } });
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const handed = yield* mech.turn({ text: `${write}\n${handoff}` });

  yield* stack.restart({ variables: {} });

  const { recalled, firstBody } = yield* recallAfterRestart({ stack, mech, after: handed.ended.sequence });
  const isSummaryOnly: (body: string) => boolean = (body) => body.includes(MEMORY_SUMMARY) && !body.includes(line);

  yield* check({
    name: guarantee,
    conditions: [
      handed.ended.type === EventType.TurnAnswered,
      recalled.type === EventType.TurnAnswered && recalled.reply.includes(line),
      Option.exists(firstBody, isSummaryOnly),
    ],
    detail: `the write and handoff ended ${turnOutcome({ ended: handed.ended })} and the read ${turnOutcome({ ended: recalled })}; the first request after the restart held the summary: ${Option.exists(firstBody, (body) => body.includes(MEMORY_SUMMARY))}, and the random line: ${Option.exists(firstBody, (body) => body.includes(line))}`,
  });
}, Effect.scoped);

/**
 * Follows the mech's events after the handoff's turn, sends the read, and answers its turn's end with the body of the
 * first request the read sent.
 */
const recallAfterRestart = Effect.fn('recallAfterRestart')(function* ({
  stack,
  mech,
  after,
}: RecallAfterRestartInput): Effect.fn.Return<RecallAfterRestart, ScenarioFailure, Scope.Scope> {
  const follower = yield* followEvents({ stack, account: mech.account, mechId: mech.id, after });
  const before = stack.modelUpstream.requests().length;
  const read = toolCallLine({ tool: ScriptedTool.MemoryRead, input: { path: ScenarioPath.Recalled } });

  yield* mech.send({ text: read, delivery: Delivery.WhenIdle });

  const recalled = yield* follower.awaitTurnEnd();
  const firstBody = Option.map(Array.head(stack.modelUpstream.requests().slice(before)), ({ body }) => body);

  return { recalled, firstBody };
});
