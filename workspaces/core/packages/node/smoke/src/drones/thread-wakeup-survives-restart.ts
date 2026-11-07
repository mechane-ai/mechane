import { EventType, ThreadList } from '@mechane/protocol';
import {
  check,
  followEvents,
  ScriptedTool,
  signedInMech,
  toolCallLine,
  verifyRequestContinuations,
} from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput } from '@mechane/testing';
import { Array, DateTime, Duration, Effect, Option } from 'effect';
import type { Scope } from 'effect';

const REPLACED_DELAY_SECONDS = 45;
const CANCELED_TITLE = 'Canceled deployment wait';
const REPLACEMENT_NOTE = 'Inspect the replacement check.';

/** A due continuation is delivered from durable state without another user message or a running shell. */
export const threadWakeupSurvivesRestart = Effect.fn('threadWakeupSurvivesRestart')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const open = toolCallLine({ tool: ScriptedTool.OpenThread, input: { title: 'Wait for the deployment' } });

  yield* mech.turn({ text: open });

  const listed = yield* mech.command({ words: ['thread', 'list'], ids: [], result: ThreadList });
  const thread = Array.head(listed.threads);

  if (Option.isNone(thread)) {
    return yield* check({
      name: guarantee,
      conditions: [false],
      detail: 'the opening turn did not create a work thread',
    });
  }

  const update = toolCallLine({
    tool: ScriptedTool.UpdateThread,
    input: {
      thread_id: thread.value.id,
      state: 'waiting',
      note: 'Inspect the current PR checks before any further push.',
      resume_after_seconds: 30,
    },
  });

  yield* mech.turn({ text: update });

  const replaced = toolCallLine({
    tool: ScriptedTool.UpdateThread,
    input: {
      thread_id: thread.value.id,
      state: 'waiting',
      note: REPLACEMENT_NOTE,
      resume_after_seconds: REPLACED_DELAY_SECONDS,
    },
  });

  const now = DateTime.nowUnsafe();
  const delay = Duration.seconds(REPLACED_DELAY_SECONDS);
  const earliest = DateTime.addDuration(now, delay);
  const scheduled = yield* mech.turn({ text: replaced });

  const openCanceled = toolCallLine({ tool: ScriptedTool.OpenThread, input: { title: CANCELED_TITLE } });

  yield* mech.turn({ text: openCanceled });

  const all = yield* mech.command({ words: ['thread', 'list'], ids: [], result: ThreadList });
  const canceled = Array.findFirst(all.threads, (candidate) => candidate.title === CANCELED_TITLE);

  if (Option.isNone(canceled)) {
    return yield* check({ name: guarantee, conditions: [false], detail: 'the second work thread was not created' });
  }

  const waitCanceled = toolCallLine({
    tool: ScriptedTool.UpdateThread,
    input: { thread_id: canceled.value.id, state: 'waiting', resume_after_seconds: 30 },
  });

  yield* mech.turn({ text: waitCanceled });

  const resolveCanceled = toolCallLine({
    tool: ScriptedTool.UpdateThread,
    input: { thread_id: canceled.value.id, state: 'resolved' },
  });

  const resolved = yield* mech.turn({ text: resolveCanceled });

  yield* stack.restart({ variables: {} });

  const follower = yield* followEvents({
    stack,
    account: mech.account,
    mechId: mech.id,
    after: resolved.ended.sequence,
  });

  const resumed = yield* follower.awaitTurnEnd();
  const events = yield* mech.logged({ after: scheduled.ended.sequence });

  const wakeups = events
    .filter((event) => event.type === EventType.InboxItemReceived)
    .filter((event) => event.text.startsWith('[Scheduled continuation]'));

  const isReplacementDue = wakeups.every((event) => DateTime.isGreaterThanOrEqualTo(event.occurredAt, earliest));
  const hasReplacementNote = wakeups.every((event) => event.text.includes(REPLACEMENT_NOTE));

  yield* check({
    name: guarantee,
    conditions: [resumed.type === EventType.TurnAnswered, wakeups.length === 1, isReplacementDue, hasReplacementNote],
    detail: `the restarted mech received ${wakeups.length} scheduled continuation and ended ${resumed.type}`,
  });

  yield* verifyRequestContinuations({ stack, guarantee });
}, Effect.scoped);
