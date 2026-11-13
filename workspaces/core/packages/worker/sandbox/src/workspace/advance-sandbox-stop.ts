import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { SANDBOX_FAILURE_MAX_CHARS, SandboxRecoveryAction, SandboxStopPhase } from '@mechane/sandbox-wire';
import type { SandboxStopReceipt } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Option, Result } from 'effect';
import { checkpointInactiveEnvironment } from '../checkpoints/checkpoint-inactive-environment.ts';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { advanceIdleWorkspace } from './advance-idle-workspace.ts';
import { requestSandboxStop } from './request-sandbox-stop.ts';

type AdvanceStopInput = WorkspaceProviderStepInput & MachineIdInput;

/** A failed checkpoint keeps live files; provider failure keeps the final drain and capacity fence. */
export async function advanceSandboxStop({
  store,
  provider,
  machineId,
  ...resources
}: AdvanceStopInput): Promise<SandboxStopReceipt> {
  const input = { store, provider, machineId, ...resources };
  const receipt = requestSandboxStop({ store });

  if (receipt.phase === SandboxStopPhase.Completed) {
    return receipt;
  }

  if (receipt.phase === SandboxStopPhase.Failed && receipt.recoveryAction !== SandboxRecoveryAction.RetryStop) {
    return receipt;
  }

  const phase = waitingPhase(input);
  const updatedAt = DateTime.nowUnsafe();

  store.saveSandboxStop({ ...receipt, phase, updatedAt });

  const promise = advanceIdleWorkspace(input);
  const checkpointed = await capturePromise({ promise });

  if (Result.isFailure(checkpointed)) {
    return failSandboxStop({
      ...input,
      receipt,
      cause: checkpointed.failure,
      recoveryAction: SandboxRecoveryAction.RepairWorkspace,
    });
  }

  const purpose = FileCheckpointPurpose.cases.Drain.make({ machineId, operationId: receipt.operationId });
  const result = store.fileCheckpointResult({ purpose });

  if (Option.isSome(result) && FileCheckpointResult.guards.Failed(result.value)) {
    return failSandboxStop({
      ...input,
      receipt,
      cause: result.value.reason,
      recoveryAction: SandboxRecoveryAction.RepairWorkspace,
    });
  }

  const state = store.workspace();
  const committedGeneration = Option.map(state.head, ({ generation }) => generation);

  if (!checkpointed.success) {
    const updated = { ...receipt, phase: waitingPhase(input), updatedAt: DateTime.nowUnsafe() };

    store.saveSandboxStop(updated);

    return updated;
  }

  const saved = checkpointInactiveEnvironment({ store });

  if (FileCheckpointResult.guards.Failed(saved)) {
    return failSandboxStop({
      ...input,
      receipt,
      cause: saved.reason,
      recoveryAction: SandboxRecoveryAction.RepairWorkspace,
    });
  }

  const stopping: SandboxStopReceipt = {
    ...receipt,
    generation: committedGeneration,
    phase: SandboxStopPhase.Stopping,
    updatedAt: DateTime.nowUnsafe(),
  };

  store.saveSandboxStop(stopping);

  const checkpoint = state.head;
  const stoppingPromise = provider.stop({ machineId, checkpoint });
  const stopped = await capturePromise({ promise: stoppingPromise });

  if (Result.isFailure(stopped)) {
    return failSandboxStop({
      ...input,
      receipt: stopping,
      cause: stopped.failure,
      recoveryAction: SandboxRecoveryAction.RetryStop,
    });
  }

  const now = DateTime.nowUnsafe();

  const completed: SandboxStopReceipt = {
    ...stopping,
    phase: SandboxStopPhase.Completed,
    updatedAt: now,
    recoveryAction: SandboxRecoveryAction.None,
  };

  store.atomic({
    run: () => {
      store.loseMachine({ machineId, now });
      store.saveSandboxStop(completed);
    },
  });

  return completed;
}

function waitingPhase({ store }: AdvanceStopInput): SandboxStopReceipt['phase'] {
  const checkpoint = store.workspace().checkpoint;

  if (Option.isSome(checkpoint)) {
    return SandboxStopPhase.Checkpointing;
  }

  const execution = store.activeExecution();

  if (Option.isSome(execution)) {
    return SandboxStopPhase.WaitingForCommands;
  }

  return SandboxStopPhase.Checkpointing;
}

type FailedStopInput = {
  readonly store: AdvanceStopInput['store'];
  readonly receipt: SandboxStopReceipt;
  readonly cause: unknown;
  readonly recoveryAction: SandboxStopReceipt['recoveryAction'];
};

/** Retains a failure under its admitted stop identity before returning it to the caller. */
export function failSandboxStop({ store, receipt, cause, recoveryAction }: FailedStopInput): SandboxStopReceipt {
  const reason = String(cause).slice(0, SANDBOX_FAILURE_MAX_CHARS).toWellFormed();

  const failed: SandboxStopReceipt = {
    ...receipt,
    phase: SandboxStopPhase.Failed,
    updatedAt: DateTime.nowUnsafe(),
    lastError: Option.some(reason),
    recoveryAction,
  };

  store.saveSandboxStop(failed);

  return failed;
}
