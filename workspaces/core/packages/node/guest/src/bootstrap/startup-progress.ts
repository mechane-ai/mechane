import { STARTUP_MAX_STEPS, StartupFailure } from '@mechane/sandbox-wire';
import type { StartupProgress } from '@mechane/sandbox-wire';
import { DateTime, Duration, Option } from 'effect';

export type StartupPhaseInput = { readonly phase: StartupProgress['phase']; readonly tool: Option.Option<string> };
export type ObserveStartupPhase = (input: StartupPhaseInput) => void;
type BeginProgressInput = Pick<StartupPhaseInput, 'phase'>;

export type GuestProgressTracker = {
  readonly advance: ObserveStartupPhase;
  readonly fail: () => void;
  readonly read: () => StartupProgress;
};

/** Guest-local work durations use one monotonic clock and never cross a process restart. */
export function createStartupProgress({ phase: initialPhase }: BeginProgressInput): GuestProgressTracker {
  const now = DateTime.nowUnsafe();
  const empty = Option.none();

  let monotonic = performance.now();

  let progress: StartupProgress = {
    phase: initialPhase,
    startedAt: now,
    updatedAt: now,
    failure: empty,
    steps: [{ phase: initialPhase, tool: empty, startedAt: now, duration: empty }],
  };

  function closeStep(): void {
    const at = DateTime.nowUnsafe();
    const observed = performance.now();
    const milliseconds = Math.max(0, observed - monotonic);
    const duration = Duration.millis(milliseconds);
    const measured = Option.some(duration);

    const steps = progress.steps.map((step, index, all) => {
      if (index !== all.length - 1) {
        return step;
      }

      return { ...step, duration: measured };
    });

    progress = { ...progress, updatedAt: at, steps };
    monotonic = observed;
  }

  function advance({ phase, tool }: StartupPhaseInput): void {
    closeStep();

    const startedAt = progress.updatedAt;
    const steps = [...progress.steps, { phase, tool, startedAt, duration: empty }].slice(-STARTUP_MAX_STEPS);

    progress = { ...progress, phase, steps };
  }

  function fail(): void {
    closeStep();

    const failure = Option.some(StartupFailure.ToolPreparation);

    progress = { ...progress, failure };
  }

  function read(): StartupProgress {
    return progress;
  }

  return { advance, fail, read };
}
