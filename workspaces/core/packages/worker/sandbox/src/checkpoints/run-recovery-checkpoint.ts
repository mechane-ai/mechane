import { RecordId } from '@mechane/records';
import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { SANDBOX_FAILURE_MAX_CHARS, SandboxRecoveryCheckpointRefusalReason } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { DateTime, Option, Result, Schema } from 'effect';
import { RecoveryCheckpointRefused } from '../errors.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';
import { releaseWorkspace } from '../workspace/release-workspace.ts';
import { expireFileCheckpoint } from './expire-file-checkpoint.ts';
import { assertRecoveryCheckpointFence } from './recovery-checkpoint-fence.ts';
import type { RecoveryCheckpointPurpose } from './recovery-checkpoint-fence.ts';
import { refuseRecoveryCheckpoint } from './refuse-recovery-checkpoint.ts';

type RecoveryCheckpointInput = WorkspaceProviderStepInput & { readonly purpose: RecoveryCheckpointPurpose };

/** Reuses the file transfer engine on the original quiet guest, without admitting a command or another machine. */
export async function runRecoveryCheckpoint({
  store,
  provider,
  workspace,
  purpose,
}: RecoveryCheckpointInput): Promise<FileCheckpointResult> {
  const input = { store, provider, workspace, purpose };
  const now = DateTime.nowUnsafe();
  const previous = store.fileCheckpointResult({ purpose });

  if (Option.isSome(previous)) {
    const operation = store.claimFileCheckpoint({ purpose, now });

    if (!FileCheckpointResult.guards.Pending(operation.result)) {
      return operation.result;
    }

    const expired = expireFileCheckpoint({ store, purpose, startedAt: operation.startedAt, now });

    if (Option.isSome(expired)) {
      return expired.value;
    }
  }

  const pending = store.pendingRecoveryCheckpoint();

  if (Option.isSome(pending) && pending.value.operationId !== purpose.operationId) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.CheckpointActive });
  }

  const checkpoint = store.workspace().checkpoint;

  if (Option.isSome(checkpoint)) {
    const current = checkpoint.value;

    const isSameOperation =
      !('executionId' in current) &&
      FileCheckpointPurpose.guards.Recovery(current.purpose) &&
      current.purpose.operationId === purpose.operationId;

    if (!isSameOperation) {
      return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.CheckpointActive });
    }

    await advanceWorkspace(input);

    const operation = store.claimFileCheckpoint({ purpose, now });

    return operation.result;
  }

  assertRecoveryCheckpointFence(input);

  const connecting = provider.connect({ machineId: purpose.machineId });
  const connected = await capturePromise({ promise: connecting });

  if (Result.isFailure(connected) || Option.isNone(connected.success)) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.MachineUnavailable });
  }

  const guest = connected.success.value;
  const checking = guest.health({ machineId: purpose.machineId });
  const checked = await capturePromise({ promise: checking });

  if (Result.isFailure(checked) || !checked.success) {
    return refuseRecoveryCheckpoint({ reason: SandboxRecoveryCheckpointRefusalReason.MachineUnavailable });
  }

  assertRecoveryCheckpointFence(input);

  const operation = store.claimFileCheckpoint({ purpose, now });
  const promise = releaseWorkspace({ ...input, machineId: purpose.machineId, guest });
  const released = await capturePromise({ promise });

  if (Result.isFailure(released)) {
    return failedRecoveryCheckpoint({ store, purpose, cause: released.failure });
  }

  if (!released.success) {
    return operation.result;
  }

  function prepare(): void {
    store.atomic({
      run: () => {
        assertRecoveryCheckpointFence(input);

        const generation = RecordId.make(crypto.randomUUID());
        const parent = purpose.committedGeneration;
        const archive = Option.none();

        store.saveCheckpoint({
          generation,
          parent,
          machineId: purpose.machineId,
          purpose,
          startedAt: operation.startedAt,
          archive,
          part: 0,
        });
      },
    });
  }

  const prepared = Result.try(prepare);

  if (Result.isFailure(prepared)) {
    return failedRecoveryCheckpoint({ store, purpose, cause: prepared.failure });
  }

  return operation.result;
}

/** The existing alarm can resume a claimed file intent after preparation lost its acknowledgement. */
export async function resumeRecoveryCheckpoint({
  store,
  provider,
  workspace,
  purpose,
}: RecoveryCheckpointInput): Promise<FileCheckpointResult> {
  const promise = runRecoveryCheckpoint({ store, provider, workspace, purpose });
  const result = await capturePromise({ promise });

  if (Result.isFailure(result) && Schema.is(RecoveryCheckpointRefused)(result.failure)) {
    return failedRecoveryCheckpoint({ store, purpose, cause: result.failure });
  }

  return Result.getOrThrow(result);
}

type FailedRecoveryInput = Pick<RecoveryCheckpointInput, 'store' | 'purpose'> & { readonly cause: unknown };

function failedRecoveryCheckpoint({ store, purpose, cause }: FailedRecoveryInput): FileCheckpointResult {
  const text: string = (() => {
    if (Schema.is(RecoveryCheckpointRefused)(cause)) {
      return `file checkpoint refused: ${cause.reason}`;
    }

    return String(cause);
  })();

  const reason = text.slice(0, SANDBOX_FAILURE_MAX_CHARS).toWellFormed();
  const result = FileCheckpointResult.cases.Failed.make({ reason });

  store.finishFileCheckpoint({ purpose, result });

  return result;
}
