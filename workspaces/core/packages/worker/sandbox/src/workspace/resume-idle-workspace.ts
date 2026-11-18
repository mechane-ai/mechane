import { FileCheckpointPurpose, FileCheckpointResult, MachineStatus } from '@mechane/sandbox-store';
import type { SandboxStore, WorkspaceRecovery } from '@mechane/sandbox-store';
import { SandboxRecoveryAction, SandboxStopOrigin, SandboxStopPhase } from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Option, Result } from 'effect';
import { AUTOMATIC_CHECKPOINT_RETRY } from '../constants.ts';
import { maintenanceActive } from '../maintenance/maintenance-active.ts';
import type { ProviderStepInput } from '../types.ts';
import { failSandboxStop } from './advance-sandbox-stop.ts';
import { releaseWorkspaceGeneration } from './release-workspace.ts';

/** A failed idle save can give its original, still-healthy home back to a foreground writer. */
export async function resumeIdleWorkspace({ store, provider }: ProviderStepInput): Promise<void> {
  const recovery = failedIdleDrain({ store });

  if (Option.isNone(recovery)) {
    return;
  }

  const { machineId, generation, reason } = recovery.value;
  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest) || !(await guest.value.health({ machineId }))) {
    return;
  }

  const lease = Option.none();

  const promise = releaseWorkspaceGeneration({ guest: guest.value, machineId, generation, lease });

  const released = await capturePromise({ promise });

  if (Result.isFailure(released) || !released.success) {
    return;
  }

  store.atomic({
    run: () => {
      const current = failedIdleDrain({ store });

      if (!Option.exists(current, (value) => value.generation === generation && value.machineId === machineId)) {
        return;
      }

      store.clearLiveRecovery({ generation, machineId });

      const now = DateTime.nowUnsafe();
      const at = DateTime.addDuration(now, AUTOMATIC_CHECKPOINT_RETRY);
      const error = Option.some(reason);

      store.scheduleAutomaticCheckpoint({ at, error });
    },
  });
}

type RecoveryInput = { readonly store: SandboxStore; readonly recovery: WorkspaceRecovery };

/** The alarm and an arriving command can both be first to observe the terminal drain result. */
export function recordFailedDrain({ store, recovery }: RecoveryInput): Option.Option<SandboxStopReceipt> {
  const { machineId, reason } = recovery;
  const latest = store.latestSandboxStop();

  if (Option.isNone(latest) || !Option.contains(latest.value.machineId, machineId)) {
    return Option.none();
  }

  const receipt = latest.value;
  const retained = Option.fromUndefinedOr(receipt.drainOperationId);
  const operationId = Option.getOrElse(retained, () => receipt.operationId);
  const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId });
  const result = store.fileCheckpointResult({ purpose });

  if (!Option.exists(result, (value) => FileCheckpointResult.guards.Failed(value) && value.reason === reason)) {
    return Option.none();
  }

  switch (receipt.phase) {
    case SandboxStopPhase.Canceled:
    case SandboxStopPhase.Completed:
      return Option.none();
    case SandboxStopPhase.Failed:
      return Option.filter(latest, (value) => value.recoveryAction === SandboxRecoveryAction.RepairWorkspace);
    case SandboxStopPhase.Canceling:
    case SandboxStopPhase.Checkpointing:
    case SandboxStopPhase.Requested:
    case SandboxStopPhase.Stopping:
    case SandboxStopPhase.WaitingForCommands: {
      const recoveryAction = SandboxRecoveryAction.RepairWorkspace;
      const failed = failSandboxStop({ store, receipt, cause: reason, recoveryAction });

      return Option.some(failed);
    }
  }
}

function failedIdleDrain({ store }: Pick<RecoveryInput, 'store'>): Option.Option<WorkspaceRecovery> {
  const state = store.workspace();
  const recovery = state.recovery;

  if (Option.isNone(recovery)) {
    return recovery;
  }

  const { machineId } = recovery.value;
  const receipt = recordFailedDrain({ store, recovery: recovery.value });

  if (!Option.exists(receipt, (value) => value.origin === SandboxStopOrigin.Idle)) {
    return Option.none();
  }

  const live = store.liveMachine();

  const originalReady = Option.exists(
    live,
    (machine) => machine.id === machineId && machine.status === MachineStatus.Ready,
  );

  if (!originalReady || maintenanceActive({ store })) {
    return Option.none();
  }

  const repair = store.pendingRecoveryCheckpoint();
  const drain = store.machineDrain({ machineId });

  if (Option.isSome(state.checkpoint) || Option.isSome(repair) || Option.isSome(drain)) {
    return Option.none();
  }

  return recovery;
}
