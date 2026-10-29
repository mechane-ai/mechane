import { Delivery, Dispatch, DispatchStatus, Drone, DroneCancel, InboxText } from '@mechane/protocol';
import type { SettlementBasis } from '@mechane/protocol';
import type { Stack } from '@mechane/stack';
import { followEvents } from '@mechane/testing';
import type { DroneEndEvent, ScenarioFailure, TalkingMech } from '@mechane/testing';
import { Effect, Schema } from 'effect';
import type { Scope } from 'effect';
import { reportTurn } from './report-turn.ts';
import type { ReportTurn, StartedDrones } from './types.ts';

/** What the mech answers after the restart, which shows the alarm's work runs again. */
const AFTER_RESTART = 'Still there after the restart?';

/** A drone as `mechane drone show` answers it, every record of a kind this release knows. */
const KnownDroneTrace = Schema.Struct({ drone: Drone, brief: InboxText, dispatches: Schema.Array(Dispatch) });

type KnownDroneTrace = typeof KnownDroneTrace.Type;

/** The scenario's mech, and what starting its drones left. */
type EndedDronesInput = { readonly stack: Stack; readonly mech: TalkingMech; readonly started: StartedDrones };

/** How a dispatch ended: the basis a settled one was priced from, or the status of one that did not settle. */
type Settlement = SettlementBasis | DispatchStatus;

/** How the drones ended: both ends, their reports' turns, the gate's runs, and how each gated dispatch ended. */
type EndedDrones = {
  readonly canceled: DroneEndEvent;
  readonly reported: DroneEndEvent;
  readonly turns: ReadonlyArray<ReportTurn>;
  readonly runs: number;
  readonly settlements: ReadonlyArray<Settlement>;
};

/**
 * Once the gated drone's command runs, restarts the deployment and follows on after the starting turn. Once a turn
 * answers after the restart, the alarm's work runs, so the sleeping drone's cancel must reach it while it works, not at
 * a catch-up the restart forces. The scenario waits for that drone's end, then opens the gate, waits for the gated
 * drone's end and each report's turn, and reads how each gated dispatch ended.
 */
export const endedDrones = Effect.fn('endedDrones')(function* ({
  stack,
  mech,
  started,
}: EndedDronesInput): Effect.fn.Return<EndedDrones, ScenarioFailure, Scope.Scope> {
  const { gate, after, gated, sleeping } = started;

  yield* gate.awaitRun;
  yield* stack.restart({ variables: {} });

  const follower = yield* followEvents({ stack, account: mech.account, mechId: mech.id, after });

  yield* mech.send({ text: AFTER_RESTART, delivery: Delivery.WhenIdle });
  yield* follower.awaitTurnEnd();

  yield* mech.command({ words: ['drone', 'cancel'], ids: [sleeping.id], result: DroneCancel });

  const canceled = yield* follower.awaitDroneEnd({ droneId: sleeping.id });

  yield* gate.open;

  const reported = yield* follower.awaitDroneEnd({ droneId: gated.id });

  const turnOf: (end: DroneEndEvent) => Effect.Effect<ReportTurn, ScenarioFailure> = (end) =>
    reportTurn({ follower, end });

  const turns = yield* Effect.forEach([canceled, reported], turnOf, { concurrency: 1 });
  const trace = yield* mech.command({ words: ['drone', 'show'], ids: [gated.id], result: KnownDroneTrace });

  const settlement: (dispatch: Dispatch) => Settlement = (dispatch) => {
    if (dispatch.status === DispatchStatus.Settled) {
      return dispatch.basis;
    }

    return dispatch.status;
  };

  const settlements = trace.dispatches.map(settlement);

  return { canceled, reported, turns, runs: yield* gate.runs, settlements };
});
