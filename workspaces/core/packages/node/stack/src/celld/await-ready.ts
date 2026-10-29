import { catalog } from '@mechane/protocol';
import { Duration, Effect, Match, Schedule } from 'effect';
import type { ChildProcess } from 'node:child_process';
import { StackStep } from '../constants.ts';
import type { StackFailed } from '../errors.ts';
import { celldLogFailure } from './celld-log-failure.ts';
import type { WorkerUnreachable } from './errors.ts';
import { probeRoute } from './probe-route.ts';

/** The celld node's own health route, which answers before celld serves the Worker. */
const CELLD_HEALTH_PATH = '/.well-known/celld/health';

/** The pause between two rounds of startup's health probes. */
const STARTUP_POLL_INTERVAL = Duration.millis(250);

/** Why a startup that ran out of time failed. */
const NO_ANSWER = 'no answer before the deadline';

/** Whether startup probes again after each failure: only after a route that did not answer yet. */
const IS_RETRIED: Readonly<Record<'WorkerUnreachable' | 'StackFailed', () => boolean>> = {
  WorkerUnreachable: () => true,
  StackFailed: () => false,
};

type AwaitReadyInput = {
  readonly origin: URL;
  readonly child: ChildProcess;
  readonly logFile: string;
  readonly startupTimeout: Duration.Duration;
};

type ProbeHealthInput = { readonly origin: URL; readonly child: ChildProcess; readonly logFile: string };

/** Waits until celld and then the Worker answer their health routes; fails when celld exits or time runs out. */
export const awaitReady = Effect.fn('awaitReady')(function* ({
  origin,
  child,
  logFile,
  startupTimeout,
}: AwaitReadyInput): Effect.fn.Return<void, StackFailed> {
  // The probes retry until the deadline, so a route that does not answer fails startup as the deadline does.
  yield* probeHealth({ origin, child, logFile }).pipe(
    Effect.retry({
      schedule: Schedule.spaced(STARTUP_POLL_INTERVAL),
      while: (failure: WorkerUnreachable | StackFailed) => Match.valueTags(failure, IS_RETRIED),
    }),
    Effect.timeoutOrElse({
      duration: startupTimeout,
      orElse: () => celldLogFailure({ logFile, step: StackStep.AwaitCelld, reason: NO_ANSWER }),
    }),
    Effect.catchTags({
      WorkerUnreachable: () => celldLogFailure({ logFile, step: StackStep.AwaitCelld, reason: NO_ANSWER }),
    }),
  );
});

/** Probes celld's own health route and then the Worker's. */
const probeHealth = Effect.fn('probeHealth')(function* ({
  origin,
  child,
  logFile,
}: ProbeHealthInput): Effect.fn.Return<void, WorkerUnreachable | StackFailed> {
  yield* probeRoute({ url: new URL(CELLD_HEALTH_PATH, origin), child, logFile });
  yield* probeRoute({ url: new URL(catalog.health.path, origin), child, logFile });
});
