import { Duration, Effect, Schedule } from 'effect';
import { FileStep } from '../constants.ts';
import { FileStepFailed } from '../errors.ts';
import { GATE_POLL_INTERVAL } from './constants.ts';
import { gateRuns } from './gate-runs.ts';
import type { GateRunsInput } from './types.ts';

/** How long a scenario waits for the gated command's first run. */
const GATE_RUN_TIMEOUT = Duration.seconds(30);

/** Reads the runs file each poll interval until the gated command has run, and fails when it has not in time. */
export const firstRun = Effect.fn('firstRun')(function* ({
  runsFile,
}: GateRunsInput): Effect.fn.Return<void, FileStepFailed> {
  const late = new FileStepFailed({
    step: FileStep.Await,
    path: runsFile,
    reason: `the gated command did not run within ${Duration.format(GATE_RUN_TIMEOUT)}`,
  });

  yield* ranOnce({ runsFile }).pipe(
    Effect.retry({ schedule: Schedule.spaced(GATE_POLL_INTERVAL) }),
    Effect.timeoutOrElse({ duration: GATE_RUN_TIMEOUT, orElse: () => Effect.fail(late) }),
  );
});

/** Reads the runs file once, and fails while the gated command has not run. */
const ranOnce = Effect.fn('ranOnce')(function* ({ runsFile }: GateRunsInput): Effect.fn.Return<void, FileStepFailed> {
  const runs = yield* gateRuns({ runsFile });

  if (runs === 0) {
    return yield* new FileStepFailed({ step: FileStep.Await, path: runsFile, reason: 'the gated command has not run' });
  }
});
