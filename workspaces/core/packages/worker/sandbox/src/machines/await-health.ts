import { StartupPhase } from '@mechane/sandbox-wire';
import { waitFor } from '@mechane/utilities';
import { DateTime, Duration, Option } from 'effect';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { restoreMachineWorkspace } from '../workspace/restore-machine-workspace.ts';

const HEALTH_INTERVAL = Duration.millis(500);
const HealthAnswer = { Healthy: 'healthy', Retry: 'retry', Late: 'late', Failed: 'failed' } as const;
type HealthAnswer = (typeof HealthAnswer)[keyof typeof HealthAnswer];
type AwaitHealthInput = WorkspaceProviderStepInput & MachineIdInput & { readonly deadline: DateTime.Utc };
type HealthAnswerInput = Omit<AwaitHealthInput, 'workspace'>;

/** The call's wait bounds observation; the machine retains its original startup budget across calls. */
export async function awaitHealth({
  store,
  provider,
  workspace,
  machineId,
  deadline,
}: AwaitHealthInput): Promise<boolean> {
  const started = performance.now();
  let answer = await healthAnswer({ store, provider, machineId, deadline });

  while (answer === HealthAnswer.Retry) {
    await waitFor({ span: HEALTH_INTERVAL });

    answer = await healthAnswer({ store, provider, machineId, deadline });
  }

  const finished = performance.now();
  const milliseconds = finished - started;

  store.recordStartupWork({ machineId, phase: StartupPhase.Bootstrap, milliseconds });

  if (answer === HealthAnswer.Failed) {
    const now = DateTime.nowUnsafe();

    await provider.stop({ machineId });
    store.failMachine({ machineId, startupDeadline: now, now });

    return false;
  }

  if (answer === HealthAnswer.Late) {
    return false;
  }

  const isRestored = await restoreMachineWorkspace({ store, provider, workspace, machineId });

  if (!isRestored) {
    return false;
  }

  const now = DateTime.nowUnsafe();

  store.advanceStartup({ machineId, phase: StartupPhase.Ready, now });
  store.readyMachine({ machineId, now });

  return true;
}

async function healthAnswer({ store, provider, machineId, deadline }: HealthAnswerInput): Promise<HealthAnswer> {
  const stored = store.latestStartup();

  if (Option.exists(stored, (value) => value.machineId === machineId && Option.isSome(value.progress.failure))) {
    return HealthAnswer.Failed;
  }

  const guest = await provider.connect({ machineId });

  if (Option.isSome(guest)) {
    const progress = await guest.value.startup({ machineId });

    if (Option.isSome(progress)) {
      const now = DateTime.nowUnsafe();

      store.observeGuestStartup({ machineId, guest: progress.value, now });

      if (Option.isSome(progress.value.bootstrap.failure)) {
        store.failStartup({ machineId, failure: progress.value.bootstrap.failure.value, now });

        return HealthAnswer.Failed;
      }

      if (progress.value.bootstrap.phase === StartupPhase.GuestReady) {
        return HealthAnswer.Healthy;
      }
    }
  }

  const now = DateTime.nowUnsafe();
  const next = DateTime.addDuration(now, HEALTH_INTERVAL);

  if (DateTime.isGreaterThanOrEqualTo(next, deadline)) {
    return HealthAnswer.Late;
  }

  return HealthAnswer.Retry;
}
