import { SandboxPhase, StartupPhase } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { observeMachine } from '../../machines/observe-machine.ts';
import { restoreSnapshot } from '../../workspace/snapshots/restore-snapshot.ts';
import { maintenanceValue } from '../maintenance-value.ts';
import type { PortableStepInput } from '../types.ts';

/** The target guest must verify every archive byte before the provider binding can change. */
export async function restoreMaintenance({ store, provider, workspace, job }: PortableStepInput): Promise<void> {
  const machineId = maintenanceValue({ value: job.target, field: 'target' });

  await observeMachine({ store, provider });

  const live = store.liveMachine();

  if (Option.isNone(live) || live.value.id !== machineId) {
    const lastError = Option.some('Replacement machine was lost before workspace restoration completed');

    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Failed, lastError });

    return;
  }

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    return;
  }

  const progress = await guest.value.startup({ machineId });

  if (Option.isNone(progress)) {
    return;
  }

  const now = DateTime.nowUnsafe();

  store.observeGuestStartup({ machineId, guest: progress.value, now });

  if (Option.isSome(progress.value.bootstrap.failure)) {
    const failure = progress.value.bootstrap.failure.value;
    const lastError = Option.some(failure);

    store.failStartup({ machineId, failure, now });
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Failed, lastError });

    return;
  }

  if (progress.value.bootstrap.phase !== StartupPhase.GuestReady) {
    return;
  }

  const snapshot = maintenanceValue({ value: job.source, field: 'source' });
  const deadline = Option.none();

  const isRestored = await restoreSnapshot({
    store,
    provider,
    workspace,
    machineId,
    guest: guest.value,
    snapshot,
    deadline,
  });

  if (!isRestored) {
    return;
  }

  const finishedAt = DateTime.nowUnsafe();

  store.advanceStartup({ machineId, phase: StartupPhase.Ready, now: finishedAt });
  store.savePortableMaintenance({ ...job, phase: SandboxPhase.Commit });
}
