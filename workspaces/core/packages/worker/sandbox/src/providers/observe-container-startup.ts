import { capturePromise } from '@mechane/utilities';
import { DateTime, Duration, Option, Result } from 'effect';
import { ContainerStartupOutcome, writeContainerStartupTiming } from '../output/write-container-startup-timing.ts';
import type { ContainerStartupStep } from '../output/write-container-startup-timing.ts';
import type { MachineIdInput } from '../types.ts';

type ObserveContainerStartupInput<Value> = MachineIdInput & {
  readonly step: ContainerStartupStep;
  readonly run: () => Value | Promise<Value>;
};

export async function observeContainerStartup<Value>({
  machineId,
  step,
  run,
}: ObserveContainerStartupInput<Value>): Promise<Value> {
  const startedAt = DateTime.nowUnsafe();
  const started = performance.now();
  const pending = Option.none();

  writeContainerStartupTiming({
    machineId,
    step,
    startedAt,
    outcome: ContainerStartupOutcome.Started,
    elapsed: pending,
  });

  async function invoke(): Promise<Value> {
    return await run();
  }

  const promise = invoke();
  const result = await capturePromise({ promise });
  const finished = performance.now();
  const duration = Duration.millis(finished - started);
  const elapsed = Option.some(duration);

  const outcome = Result.match(result, {
    onFailure: () => ContainerStartupOutcome.Failed,
    onSuccess: () => ContainerStartupOutcome.Succeeded,
  });

  writeContainerStartupTiming({ machineId, step, startedAt, outcome, elapsed });

  return Result.getOrThrow(result);
}
