import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import type { SandboxStore } from '@mechane/sandbox-store';
import { SandboxRecoveryAction, SandboxStopOrigin, SandboxStopPhase } from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { SANDBOX_IDLE } from '../constants.ts';
import type { MachineIdInput, ProviderStepInput } from '../types.ts';
import { releaseWorkspaceGeneration } from './release-workspace.ts';

type StopIdentityInput = MachineIdInput & { readonly store: SandboxStore; readonly receipt: SandboxStopReceipt };
type CancelIdleStopInput = StopIdentityInput & ProviderStepInput;

const CANCELLABLE_PHASES: ReadonlySet<SandboxStopReceipt['phase']> = new Set([
  SandboxStopPhase.Requested,
  SandboxStopPhase.WaitingForCommands,
  SandboxStopPhase.Checkpointing,
]);

export function canCancelIdleStop({ store, machineId, receipt }: StopIdentityInput): boolean {
  if (!Option.contains(receipt.machineId, machineId)) {
    return false;
  }

  const live = store.liveMachine();

  if (!Option.exists(live, (machine) => machine.id === machineId)) {
    return false;
  }

  const drain = store.machineDrain({ machineId });

  if (!Option.exists(drain, (value) => value.operationId === receipt.operationId)) {
    return false;
  }

  if (receipt.phase === SandboxStopPhase.Canceling) {
    return true;
  }

  if (receipt.origin !== SandboxStopOrigin.Idle || !CANCELLABLE_PHASES.has(receipt.phase)) {
    return false;
  }

  const requestedAt = receipt.requestedAt;
  const pending = store.latestPendingExecutionAt();

  if (
    Option.isNone(requestedAt) ||
    !Option.exists(pending, (at) => DateTime.isGreaterThanOrEqualTo(at, requestedAt.value))
  ) {
    return false;
  }

  const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId: receipt.operationId });
  const result = store.fileCheckpointResult({ purpose });
  const active = store.workspace().checkpoint;
  const isDraining = Option.exists(active, (checkpoint) => checkpoint.purpose.operationId === receipt.operationId);

  return !isDraining && !Option.exists(result, FileCheckpointResult.guards.Failed);
}

/** Once release can reach the guest, even a canceled command cannot turn this operation back into a stop. */
export async function cancelIdleStop({
  store,
  provider,
  machineId,
  receipt,
}: CancelIdleStopInput): Promise<SandboxStopReceipt> {
  const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId: receipt.operationId });
  const result = store.fileCheckpointResult({ purpose });
  const committed = Option.filter(result, FileCheckpointResult.guards.Committed);

  if (Option.isNone(committed)) {
    return finishIdleStopCancellation({ store, machineId, receipt });
  }

  const generation = committed.value.generation;

  const canceling = {
    ...receipt,
    phase: SandboxStopPhase.Canceling,
    generation: Option.some(generation),
    updatedAt: DateTime.nowUnsafe(),
  };

  store.saveSandboxStop(canceling);

  const guest = await provider.connect({ machineId });

  if (Option.isNone(guest)) {
    return canceling;
  }

  const lease = Option.none();
  const released = await releaseWorkspaceGeneration({ guest: guest.value, machineId, generation, lease });

  if (!released) {
    return canceling;
  }

  return finishIdleStopCancellation({ store, machineId, receipt: canceling });
}

function finishIdleStopCancellation({ store, machineId, receipt }: StopIdentityInput): SandboxStopReceipt {
  if (receipt.origin === SandboxStopOrigin.Explicit) {
    return replaceReleasedDrain({ store, machineId, receipt });
  }

  const now = DateTime.nowUnsafe();
  const idleAt = DateTime.addDuration(now, SANDBOX_IDLE);

  const canceled = {
    ...receipt,
    phase: SandboxStopPhase.Canceled,
    updatedAt: now,
    recoveryAction: SandboxRecoveryAction.None,
  };

  store.atomic({
    run: () => {
      const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId: receipt.operationId });
      const checkpoint = store.fileCheckpointResult({ purpose });

      if (Option.exists(checkpoint, FileCheckpointResult.guards.Pending)) {
        const result = FileCheckpointResult.cases.Failed.make({ reason: 'New work canceled the idle stop' });

        store.finishFileCheckpoint({ purpose, result });
      }

      store.clearMachineDrain({ machineId });
      store.saveSandboxStop(canceled);
      store.setSandboxIdleAt({ at: idleAt });
    },
  });

  return canceled;
}

/** The prior freeze can already have reached release, so an explicit stop needs a fresh drain. */
function replaceReleasedDrain({ store, machineId, receipt }: StopIdentityInput): SandboxStopReceipt {
  return store.atomic({
    run: () => {
      store.clearMachineDrain({ machineId });

      const drain = store.requestMachineDrain({ machineId });

      const requested = {
        ...receipt,
        drainOperationId: drain.operationId,
        phase: SandboxStopPhase.Requested,
        updatedAt: DateTime.nowUnsafe(),
      };

      store.saveSandboxStop(requested);

      return requested;
    },
  });
}
