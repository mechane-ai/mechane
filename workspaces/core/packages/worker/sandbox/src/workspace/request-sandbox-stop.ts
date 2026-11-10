import { SandboxOperationId } from '@mechane/records';
import type { SandboxStore } from '@mechane/sandbox-store';
import { FileCheckpointResult } from '@mechane/sandbox-store';
import { SANDBOX_FAILURE_MAX_CHARS, SandboxRecoveryAction, SandboxStopPhase } from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { checkpointInactiveEnvironment } from '../checkpoints/checkpoint-inactive-environment.ts';
import { maintenanceActive } from '../maintenance/maintenance-active.ts';
import { inspectSandboxStop } from './backfill-sandbox-stop.ts';

type StopRequestInput = { readonly store: SandboxStore };

/** Repeated requests attach to the original machine's stop, including a retained failure. */
export function requestSandboxStop({ store }: StopRequestInput): SandboxStopReceipt {
  const previous = inspectSandboxStop({ store });
  const machine = store.latestMachine();
  const machineId = Option.map(machine, ({ id }) => id);
  const state = store.workspace();
  const recovery = state.recovery;
  const committed = Option.map(state.head, ({ generation }) => generation);

  if (Option.isSome(previous) && Option.getOrNull(previous.value.machineId) === Option.getOrNull(machineId)) {
    const receipt = previous.value;
    const needsRepair = receipt.recoveryAction === SandboxRecoveryAction.RepairWorkspace;
    const hasFreshSave = Option.getOrNull(committed) !== Option.getOrNull(receipt.generation);
    const canRetryRepair = needsRepair && hasFreshSave;

    const wasWaiting =
      receipt.phase === SandboxStopPhase.Failed && receipt.recoveryAction === SandboxRecoveryAction.Wait;

    const canRetryWait = wasWaiting && !maintenanceActive({ store });

    if (!canRetryRepair && !canRetryWait) {
      return receipt;
    }
  }

  const now = DateTime.nowUnsafe();
  const live = store.liveMachine();
  const operationId = SandboxOperationId.make(crypto.randomUUID());

  const initial: SandboxStopReceipt = {
    operationId,
    machineId,
    requestedAt: Option.some(now),
    updatedAt: now,
    phase: SandboxStopPhase.Requested,
    generation: committed,
    lastError: Option.none(),
    recoveryAction: SandboxRecoveryAction.Wait,
  };

  if (Option.isSome(recovery)) {
    const reason = recovery.value.reason.slice(0, SANDBOX_FAILURE_MAX_CHARS).toWellFormed();
    const lastError = Option.some(reason);

    return store.claimSandboxStop({
      ...initial,
      phase: SandboxStopPhase.Failed,
      lastError,
      recoveryAction: SandboxRecoveryAction.RepairWorkspace,
    });
  }

  if (maintenanceActive({ store })) {
    const lastError = Option.some('Environment maintenance must finish before stopping');

    return store.claimSandboxStop({ ...initial, phase: SandboxStopPhase.Failed, lastError });
  }

  if (Option.isNone(live)) {
    const saved = checkpointInactiveEnvironment({ store });

    if (FileCheckpointResult.guards.Failed(saved)) {
      const lastError = Option.some(saved.reason);

      return store.claimSandboxStop({
        ...initial,
        phase: SandboxStopPhase.Failed,
        lastError,
        recoveryAction: SandboxRecoveryAction.RepairWorkspace,
      });
    }

    if (Option.isSome(machine)) {
      return store.claimSandboxStop(initial);
    }

    return store.claimSandboxStop({
      ...initial,
      phase: SandboxStopPhase.Completed,
      recoveryAction: SandboxRecoveryAction.None,
    });
  }

  const drain = store.requestMachineDrain({ machineId: live.value.id });

  return store.claimSandboxStop({ ...initial, operationId: drain.operationId });
}
