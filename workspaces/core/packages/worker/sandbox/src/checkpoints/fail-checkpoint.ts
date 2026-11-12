import { MachineId } from '@mechane/records';
import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { guestWorkspacePath, SANDBOX_FAILURE_MAX_CHARS } from '@mechane/sandbox-wire';
import { DateTime, Duration, Option, Schema } from 'effect';
import { AUTOMATIC_CHECKPOINT_RETRY } from '../constants.ts';
import { WorkspaceTransferFailed, WorkspaceTransferPhase } from '../errors.ts';
import type { CheckpointStepInput } from './types.ts';

type FailedCheckpointInput = CheckpointStepInput & { readonly cause: unknown; readonly elapsed: Duration.Duration };
type WorkspaceTransferObservation = NonNullable<WorkspaceTransferFailed['observation']>;

/** Keeps failed live files available without replacing their last committed snapshot. */
export function failCheckpoint({ store, checkpoint, cause, elapsed }: FailedCheckpointInput): void {
  const { machineId, generation } = checkpoint;

  const reason = failureReason({ checkpoint, cause, elapsed });

  if (FileCheckpointPurpose.guards.Automatic(checkpoint.purpose)) {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, AUTOMATIC_CHECKPOINT_RETRY);
    const error = Option.some(reason);

    store.atomic({
      run: () => {
        store.retireWorkspace({ generation });
        store.scheduleAutomaticCheckpoint({ at, error });
      },
    });

    return;
  }

  const recover: () => void = () => {
    const result = FileCheckpointResult.cases.Failed.make({ reason });

    store.finishFileCheckpoint({ purpose: checkpoint.purpose, result });

    if (FileCheckpointPurpose.guards.Recovery(checkpoint.purpose)) {
      return;
    }

    if (FileCheckpointPurpose.guards.Drain(checkpoint.purpose)) {
      const identity = MachineId.make(machineId);

      store.clearMachineDrain({ machineId: identity });
    }

    store.recoverWorkspace({ generation, machineId, reason });
  };

  store.atomic({ run: recover });
}

function failureReason({
  checkpoint,
  cause,
  elapsed,
}: Pick<FailedCheckpointInput, 'checkpoint' | 'cause' | 'elapsed'>): string {
  const transfer: Option.Option<WorkspaceTransferFailed> = (() => {
    if (Schema.is(WorkspaceTransferFailed)(cause)) {
      return Option.some(cause);
    }

    return Option.none();
  })();

  const defaultPhase: WorkspaceTransferPhase = (() => {
    if (Option.isNone(checkpoint.archive)) {
      return WorkspaceTransferPhase.Archive;
    }

    if (checkpoint.part < checkpoint.archive.value.parts) {
      return WorkspaceTransferPhase.Parts;
    }

    return WorkspaceTransferPhase.Manifest;
  })();

  const observed = Option.flatMap(transfer, (failure) => Option.fromUndefinedOr(failure.observation));

  const observation: WorkspaceTransferObservation = Option.getOrElse(observed, () => ({
    phase: defaultPhase,
    elapsed,
  }));

  const knownPath = Option.map(transfer, (failure) => {
    const part = Option.fromUndefinedOr(observation.part);

    return guestWorkspacePath({
      machineId: checkpoint.machineId,
      generation: failure.generation,
      step: failure.step,
      part,
    });
  });

  const path = Option.getOrNull(knownPath);
  const elapsedMs = Duration.toMillis(observation.elapsed);
  const stepElapsedMs = Duration.toMillis(elapsed);

  const metadata = JSON.stringify({
    operationId: checkpoint.purpose.operationId,
    generation: checkpoint.generation,
    path,
    cursor: checkpoint.part,
    phase: observation.phase,
    elapsedMs,
    stepElapsedMs,
  });

  const reason = Option.match(transfer, { onSome: (failure) => failure.reason, onNone: () => String(cause) });

  return `workspace transfer ${metadata}: ${reason}`.slice(0, SANDBOX_FAILURE_MAX_CHARS);
}
