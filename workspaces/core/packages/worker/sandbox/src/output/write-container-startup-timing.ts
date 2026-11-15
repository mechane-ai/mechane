import { MachineId } from '@mechane/records';
import { DateTime, Duration, Option, Result, Schema } from 'effect';

export const ContainerStartupStep = {
  Cache: 'cache',
  HttpsIntercept: 'https_intercept',
  HttpIntercept: 'http_intercept',
  Start: 'start',
  InactivityLease: 'inactivity_lease',
} as const;

export type ContainerStartupStep = (typeof ContainerStartupStep)[keyof typeof ContainerStartupStep];

export const ContainerStartupOutcome = { Started: 'started', Succeeded: 'succeeded', Failed: 'failed' } as const;
type ContainerStartupOutcome = (typeof ContainerStartupOutcome)[keyof typeof ContainerStartupOutcome];

type ContainerStartupTimingInput = {
  readonly machineId: MachineId;
  readonly step: ContainerStartupStep;
  readonly startedAt: DateTime.Utc;
  readonly outcome: ContainerStartupOutcome;
  readonly elapsed: Option.Option<Duration.Duration>;
};

export function writeContainerStartupTiming({
  machineId,
  step,
  startedAt,
  outcome,
  elapsed,
}: ContainerStartupTimingInput): void {
  const written = Result.try(() => {
    if (!Schema.is(MachineId)(machineId)) {
      return;
    }

    const startedAtMs = DateTime.toEpochMillis(startedAt);
    const measured = Option.map(elapsed, Duration.toMillis);
    const elapsedMs = Option.getOrNull(measured);

    const line = JSON.stringify({
      event: 'sandbox.container_startup',
      machineId,
      step,
      startedAtMs,
      outcome,
      elapsedMs,
    });

    console.log(line);
  });

  Result.getOrElse(written, () => undefined);
}
