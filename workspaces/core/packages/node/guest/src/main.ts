import { finish, interruptOnSignal, reportExit } from '@mechane/program';
import type { FailureLines } from '@mechane/program';
import { capturePromise } from '@mechane/utilities';
import { Deferred, Effect, Match, Result } from 'effect';
import { SessionWorkerFailed } from './errors.ts';
import { guestCommand } from './load-guest-settings.ts';
import { MANAGED_WORK_ARGUMENT } from './managed-work/launch.ts';
import { runManagedWorker } from './managed-work/run-worker.ts';
import { serveGuest } from './serve-guest.ts';
import type { GuestFailure } from './types.ts';

/** The guest's name, which prefixes each diagnostic it writes. */
const GUEST_PROGRAM = 'mechane guest';

/** How the guest ends: a stop signal ends a healthy guest, and one that could not serve ends as failed. */
const GuestStatus = { Stopped: 0, Failed: 1 } as const;

type ProgramFailure = GuestFailure | SessionWorkerFailed;

/** What each failure of the guest says it did and why it failed. */
const FAILURE_LINES: Readonly<FailureLines<ProgramFailure>> = {
  SessionWorkerFailed: () => 'Session worker could not complete its claim',
  GuestMisconfigured: ({ reason }) => `read the guest's environment: ${reason}`,
  GuestUnreachable: ({ host, port, reason }) => `listen on ${host}:${port}: ${reason}`,
  ExecutionUnstarted: ({ executionId, reason }) => `start bash for execution ${executionId}: ${reason}`,
};

/**
 * Serves the machine's executions until a stop signal arrives, which stops every execution still running and ends the
 * guest stopped. A guest that never restarts is what lets an execution's id run once.
 */
async function main(): Promise<void> {
  const isWorker = guestCommand.mode === MANAGED_WORK_ARGUMENT;
  let program: Effect.Effect<void, ProgramFailure> = serveGuest();
  let operation = 'serve the machine';

  if (isWorker) {
    program = Effect.callback<void, SessionWorkerFailed>((resume, signal) => {
      const closed = Deferred.makeUnsafe<void>();

      async function work(): Promise<void> {
        const promise = runManagedWorker({ signal, runCommand: Effect.runPromise });
        const result = await capturePromise({ promise });

        Deferred.doneUnsafe(closed, Effect.void);

        if (Result.isFailure(result)) {
          const failed = new SessionWorkerFailed({});

          resume(failed);
        } else {
          resume(Effect.void);
        }
      }

      void work();

      return Deferred.await(closed);
    });

    operation = 'execute the session claim';
  }

  const interrupted = interruptOnSignal({ program });
  const exit = await Effect.runPromiseExit(interrupted);

  const status = reportExit({
    exit,
    program: GUEST_PROGRAM,
    operation,
    describe: ({ failure }) => Match.valueTags(failure, FAILURE_LINES),
    succeeded: () => GuestStatus.Stopped,
    failed: GuestStatus.Failed,
  });

  finish({ status });
}

await main();
