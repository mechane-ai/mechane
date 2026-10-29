import { Drone, EventType, SettlementBasis, UnansweredReason } from '@mechane/protocol';
import { COMMAND_PREFIX } from '@mechane/stack';
import type { Stack } from '@mechane/stack';
import { check, commandGate, ScriptedTool, signedInMech, toolCallLine } from '@mechane/testing';
import type { ScenarioFailure, ScenarioInput, TalkingMech } from '@mechane/testing';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { endedDrones } from './ended-drones.ts';
import { OneThread } from './schemas.ts';
import type { StartedDrones } from './types.ts';

/** The scenario's mech, which its CLI calls name. */
type StartedDronesInput = { readonly stack: Stack; readonly mech: TalkingMech };

/** The file the mech makes in its own sandbox, which no drone's sandbox holds. */
const MECH_FILE = 'mech-only';

/** What the gated drone prints once its gate opens. */
const RELEASED = 'released';

/** A mech's drones as `mechane drone list` answers them, when the mech started two. */
const TwoDrones = Schema.Struct({ drones: Schema.Tuple([Drone, Drone]) });

type TwoDrones = typeof TwoDrones.Type;

/**
 * A mech makes a file in its own sandbox and starts two drones on a thread: one lists its home and waits at a gate, the
 * other sleeps. While the first waits, the deployment restarts, a member cancels the second, and the gate opens once it
 * ends; the first then reports its listing without the mech's file. Its gate ran once, its two dispatches settled from
 * usage, and each report reaches the mech as an item of its own, whose turn answers with it.
 */
export const droneReportsOnceThroughTheInbox = Effect.fn('droneReportsOnceThroughTheInbox')(function* ({
  stack,
  guarantee,
}: ScenarioInput): Effect.fn.Return<void, ScenarioFailure, Scope.Scope> {
  const mech = yield* signedInMech({ stack, offer: 'echo' });
  const started = yield* startedDrones({ stack, mech });
  const { canceled, reported, ...ended } = yield* endedDrones({ stack, mech, started });

  yield* check({
    name: guarantee,
    conditions: [
      reported.type === EventType.DroneReported &&
        reported.report.includes(RELEASED) &&
        !reported.report.includes(MECH_FILE),
      ended.runs === 1,
      canceled.type === EventType.DroneUnreported && canceled.reason === UnansweredReason.Canceled,
      ended.turns.every(({ isReportAnswered }) => isReportAnswered),
      ended.settlements.join(',') === [SettlementBasis.Usage, SettlementBasis.Usage].join(','),
    ],
    detail: `the gated drone ended ${JSON.stringify(reported)} after its gate ran ${ended.runs} times, with dispatches that ended ${ended.settlements.join(', ')}; the canceled one ended ${JSON.stringify(canceled)}; the report turns were ${JSON.stringify(ended.turns)}`,
  });
}, Effect.scoped);

/**
 * Opens a thread and makes the mech's file in one turn, and starts the two drones on the thread in the next. The first
 * lists its home, waits at a gate and prints its marker, and the second sleeps.
 */
const startedDrones = Effect.fn('startedDrones')(function* ({
  stack,
  mech,
}: StartedDronesInput): Effect.fn.Return<StartedDrones, ScenarioFailure> {
  const open = toolCallLine({ tool: ScriptedTool.OpenThread, input: { title: 'Survey the sandbox' } });

  yield* mech.turn({ text: `${open}\n${COMMAND_PREFIX}touch ${MECH_FILE}` });

  const {
    threads: [thread],
  } = yield* mech.command({ words: ['thread', 'list'], ids: [], result: OneThread });

  const gate = yield* commandGate({ stack });
  const briefs = [`${COMMAND_PREFIX}ls -a && ${gate.bash} && echo ${RELEASED}`, `${COMMAND_PREFIX}sleep 300`];

  const starts = briefs.map((brief) =>
    toolCallLine({ tool: ScriptedTool.StartDrone, input: { thread_id: thread.id, brief } }),
  );

  const { ended } = yield* mech.turn({ text: starts.join('\n') });

  const {
    drones: [gated, sleeping],
  } = yield* mech.command({ words: ['drone', 'list'], ids: [], result: TwoDrones });

  return { gate, after: ended.sequence, gated, sleeping };
});
