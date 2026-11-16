import { SandboxOperationId } from '@mechane/records';
import type { SandboxStore } from '@mechane/sandbox-store';
import { FileCheckpointResult } from '@mechane/sandbox-store';
import {
  SANDBOX_FAILURE_MAX_CHARS,
  SandboxRecoveryAction,
  SandboxStopOrigin,
  SandboxStopPhase,
} from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { checkpointInactiveEnvironment } from '../checkpoints/checkpoint-inactive-environment.ts';
import { maintenanceActive } from '../maintenance/maintenance-active.ts';
import { inspectSandboxStop } from './backfill-sandbox-stop.ts';

type StopRequestInput = { readonly store: SandboxStore; readonly origin: NonNullable<SandboxStopReceipt['origin']> };

/** Repeated requests attach to the original machine's stop, including a retained failure. */
export function requestSandboxStop({ store, origin }: StopRequestInput): SandboxStopReceipt {
  const reused = currentStop({ store, origin });

  if (Option.isSome(reused)) {
    return reused.value;
  }

  const machine = store.latestMachine();
  const machineId = Option.map(machine, ({ id }) => id);
  const state = store.workspace();
  const recovery = state.recovery;
  const committed = Option.map(state.head, ({ generation }) => generation);
  const now = DateTime.nowUnsafe();
  const live = store.liveMachine();
  const operationId = SandboxOperationId.make(crypto.randomUUID());

  const initial: SandboxStopReceipt = {
    origin,
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
    return requestInactiveStop({ store, initial });
  }

  return store.atomic({
    run: () => {
      const drain = store.requestMachineDrain({ machineId: live.value.id });

      return store.claimSandboxStop({ ...initial, operationId: drain.operationId });
    },
  });
}

function currentStop({ store, origin }: StopRequestInput): Option.Option<SandboxStopReceipt> {
  const previous = inspectSandboxStop({ store });
  const machine = store.latestMachine();
  const machineId = Option.map(machine, ({ id }) => id);

  if (Option.isNone(previous)) {
    return previous;
  }

  const receipt = previous.value;
  const isSameMachine = Option.getOrNull(receipt.machineId) === Option.getOrNull(machineId);

  if (!isSameMachine || receipt.phase === SandboxStopPhase.Canceled) {
    return Option.none();
  }

  const workspace = store.workspace();
  const committed = Option.map(workspace.head, ({ generation }) => generation);
  const needsRepair = receipt.recoveryAction === SandboxRecoveryAction.RepairWorkspace;
  const hasFreshSave = Option.getOrNull(committed) !== Option.getOrNull(receipt.generation);
  const canRetryRepair = needsRepair && hasFreshSave;
  const wasWaiting = receipt.phase === SandboxStopPhase.Failed && receipt.recoveryAction === SandboxRecoveryAction.Wait;
  const canRetryWait = wasWaiting && !maintenanceActive({ store });

  if (canRetryRepair || canRetryWait) {
    return Option.none();
  }

  const canPromote = receipt.phase !== SandboxStopPhase.Completed;

  if (origin === SandboxStopOrigin.Explicit && receipt.origin !== origin && canPromote) {
    const promoted = { ...receipt, origin, updatedAt: DateTime.nowUnsafe() };

    store.saveSandboxStop(promoted);

    return Option.some(promoted);
  }

  return previous;
}

type InactiveStopInput = Pick<StopRequestInput, 'store'> & { readonly initial: SandboxStopReceipt };

function requestInactiveStop({ store, initial }: InactiveStopInput): SandboxStopReceipt {
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

  if (Option.isSome(initial.machineId)) {
    return store.claimSandboxStop(initial);
  }

  return store.claimSandboxStop({
    ...initial,
    phase: SandboxStopPhase.Completed,
    recoveryAction: SandboxRecoveryAction.None,
  });
}
