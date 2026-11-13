import { MachineId } from '@mechane/records';
import { MachineStatus } from '@mechane/sandbox-store';
import { StartupPhase, WorkspaceRestoreSource } from '@mechane/sandbox-wire';
import { waitFor } from '@mechane/utilities';
import { DateTime, Duration, Option } from 'effect';
import { writeRestoreStageTiming } from '../output/write-sandbox-diagnostic.ts';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { restoreMachineWorkspace } from '../workspace/restore-machine-workspace.ts';
import { failLateMachine } from './fail-late-machine.ts';

const HEALTH_INTERVAL = Duration.millis(500);
const HealthAnswer = { Healthy: 'healthy', Retry: 'retry', Late: 'late', Failed: 'failed' } as const;
type HealthAnswer = (typeof HealthAnswer)[keyof typeof HealthAnswer];
type AwaitHealthInput = WorkspaceProviderStepInput & MachineIdInput & { readonly deadline: DateTime.Utc };
type HealthAnswerInput = Omit<AwaitHealthInput, 'workspace'>;

/** Retains the machine's original startup budget while health and restoration are observed. */
export async function awaitHealth({
  store,
  provider,
  workspace,
  machineId,
  deadline,
}: AwaitHealthInput): Promise<boolean> {
  const startedAt = DateTime.nowUnsafe();
  const started = performance.now();
  let answer = await healthAnswer({ store, provider, machineId, deadline });

  while (answer === HealthAnswer.Retry) {
    await waitFor({ span: HEALTH_INTERVAL });

    answer = await healthAnswer({ store, provider, machineId, deadline });
  }

  const finished = performance.now();
  const milliseconds = finished - started;

  const startup = store.latestStartup();
  const timingHead = store.workspace().head;

  const isTransferring = Option.exists(
    startup,
    (value) => value.machineId === machineId && value.progress.phase === StartupPhase.Transfer,
  );

  if (isTransferring && Option.isSome(timingHead)) {
    const elapsed = Duration.millis(milliseconds);

    writeRestoreStageTiming({
      stage: 'health',
      machineId,
      generation: timingHead.value.generation,
      startedAt,
      elapsed,
    });
  }

  store.recordStartupWork({ machineId, phase: StartupPhase.Bootstrap, milliseconds });

  if (answer === HealthAnswer.Failed) {
    const now = DateTime.nowUnsafe();

    const cacheCheckpoint = Option.none();

    await provider.stop({ machineId, checkpoint: cacheCheckpoint });
    store.failMachine({ machineId, startupDeadline: now, now });

    return false;
  }

  if (answer === HealthAnswer.Late) {
    return false;
  }

  const head = store.workspace().head;
  const isRestored = await restoreMachineWorkspace({ store, provider, workspace, machineId, deadline });

  if (!isRestored) {
    return false;
  }

  const live = store.liveMachine();

  const starting = Option.filter(
    live,
    (machine) => machine.id === machineId && machine.status === MachineStatus.Starting,
  );

  if (Option.isNone(starting)) {
    return false;
  }

  const identity = MachineId.make(machineId);

  const pendingDrain = store.machineDrain({ machineId: identity });

  if (Option.isSome(pendingDrain)) {
    return false;
  }

  await failLateMachine({ store, provider, machineId, startedAt: starting.value.startedAt });

  const current = store.liveMachine();

  const isStarting = Option.exists(
    current,
    (machine) => machine.id === machineId && machine.status === MachineStatus.Starting,
  );

  const drain = store.machineDrain({ machineId: identity });
  const state = store.workspace();

  const filesRestored = Option.match(head, {
    onNone: () => Option.isNone(state.head),
    onSome: (snapshot) => {
      const sameHead = Option.exists(state.head, (currentHead) => currentHead.generation === snapshot.generation);

      const restored = Option.exists(state.restoration, (restoration) => {
        const sameMachine = restoration.machineId === machineId && restoration.generation === snapshot.generation;

        const complete =
          restoration.source === WorkspaceRestoreSource.Native || restoration.part === snapshot.archive.parts;

        return sameMachine && complete;
      });

      return sameHead && restored;
    },
  });

  if (!isStarting || Option.isSome(drain) || !filesRestored) {
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
