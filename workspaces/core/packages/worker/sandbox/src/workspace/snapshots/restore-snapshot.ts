import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { WorkspaceRestoration, WorkspaceSnapshot } from '@mechane/sandbox-store';
import { SandboxArchive, StartupFailure, StartupPhase, WorkspaceStep } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Array, DateTime, Option, Result, Schema } from 'effect';
import {
  WORKSPACE_RESTORE_ADMISSION_BATCH_PARTS,
  WORKSPACE_RESTORE_ADMISSION_DURATION,
  WORKSPACE_RESTORE_CONCURRENT_PARTS,
  WORKSPACE_TRANSFER_BATCH_DURATION,
  WORKSPACE_TRANSFER_BATCH_PARTS,
} from '../../constants.ts';
import type { GuestConnection, MachineIdInput, WorkspaceProviderStepInput } from '../../types.ts';
import { verifyGenerationManifest } from '../generation-manifest.ts';
import { workspaceRequest } from '../workspace-request.ts';
import { copySnapshotBatch } from './copy-snapshot-batch.ts';
import { isCurrentRestoration } from './current-restoration.ts';

type RestoreSnapshotInput = WorkspaceProviderStepInput &
  MachineIdInput & {
    readonly guest: GuestConnection;
    readonly snapshot: WorkspaceSnapshot;
    readonly deadline: Option.Option<DateTime.Utc>;
  };

/** An imported candidate must pass the same bounded guest verification as a committed snapshot. */
export async function restoreSnapshot({
  store,
  provider,
  workspace,
  guest,
  machineId,
  snapshot,
  deadline: admissionDeadline,
}: RestoreSnapshotInput): Promise<boolean> {
  const { generation, archive } = snapshot;
  const observedAt = DateTime.nowUnsafe();

  const restored = store.workspace().restoration;

  if (Option.isNone(restored) || restored.value.part < archive.parts) {
    store.advanceStartup({ machineId, phase: StartupPhase.Transfer, now: observedAt });
  }

  if (Option.isNone(restored) || restored.value.machineId !== machineId || restored.value.generation !== generation) {
    await verifyGenerationManifest({ workspace, snapshot });

    const startedAt = DateTime.nowUnsafe();

    store.saveRestoration({ machineId, generation, part: 0, startedAt });

    return false;
  }

  if (restored.value.part === archive.parts) {
    return await activateSnapshot({ store, guest, restoration: restored.value, archive });
  }

  const startedAt = DateTime.nowUnsafe();
  const sliceDeadline = DateTime.addDuration(startedAt, WORKSPACE_TRANSFER_BATCH_DURATION);
  const maximumDeadline = DateTime.addDuration(startedAt, WORKSPACE_RESTORE_ADMISSION_DURATION);

  // Keep the existing progress slice even when the caller's wait has elapsed.
  const requestedDeadline = Option.match(admissionDeadline, {
    onNone: () => sliceDeadline,
    onSome: (value) => DateTime.max(sliceDeadline, value),
  });

  const deadline = DateTime.min(requestedDeadline, maximumDeadline);
  const hasExtraBudget = DateTime.isGreaterThan(deadline, sliceDeadline);
  let batchParts = WORKSPACE_TRANSFER_BATCH_PARTS;

  if (hasExtraBudget) {
    batchParts = WORKSPACE_RESTORE_ADMISSION_BATCH_PARTS;
  }

  const partLimit = Math.min(restored.value.part + batchParts, archive.parts);
  const parts = Array.range(restored.value.part, partLimit - 1);
  const batches = Array.chunksOf(parts, WORKSPACE_RESTORE_CONCURRENT_PARTS);

  for (const batch of batches) {
    const part = Array.headNonEmpty(batch);
    const current = store.workspace().restoration;

    if (Option.isNone(current) || current.value.machineId !== machineId || current.value.generation !== generation) {
      return false;
    }

    if (current.value.part !== part) {
      return false;
    }

    const now = DateTime.nowUnsafe();

    if (DateTime.isGreaterThanOrEqualTo(now, deadline)) {
      return false;
    }

    const started = performance.now();
    const promise = copySnapshotBatch({ store, provider, workspace, guest, snapshot, restoration: current.value });
    const copied = await capturePromise({ promise });
    const finished = performance.now();
    const milliseconds = finished - started;
    const copiedAt = DateTime.nowUnsafe();

    store.recordStartupWork({ machineId, phase: StartupPhase.Transfer, milliseconds });

    if (Result.isFailure(copied)) {
      store.failStartup({ machineId, failure: StartupFailure.Restore, now: copiedAt });
    }

    Result.getOrThrow(copied);

    const advanced = store.workspace().restoration;

    if (Option.isNone(advanced)) {
      return false;
    }

    if (
      advanced.value.machineId !== machineId ||
      advanced.value.generation !== generation ||
      advanced.value.part !== Math.min(part + WORKSPACE_RESTORE_CONCURRENT_PARTS, archive.parts)
    ) {
      return false;
    }

    store.observeRestoration({
      machineId,
      restoration: { generation, bytes: archive.bytes, parts: archive.parts, copiedParts: advanced.value.part },
      now: copiedAt,
    });

    if (advanced.value.part === archive.parts) {
      return await activateSnapshot({ store, guest, restoration: advanced.value, archive });
    }
  }

  return false;
}

type ActivateSnapshotInput = Pick<RestoreSnapshotInput, 'store' | 'guest'> & {
  readonly restoration: WorkspaceRestoration;
  readonly archive: SandboxArchive;
};

async function activateSnapshot({ store, guest, restoration, archive }: ActivateSnapshotInput): Promise<boolean> {
  const { machineId, generation } = restoration;
  const observedAt = DateTime.nowUnsafe();

  store.advanceStartup({ machineId, phase: StartupPhase.Restore, now: observedAt });

  const schema = Schema.toType(SandboxArchive);
  const codec = Schema.fromJsonString(schema);
  const body = Schema.encodeSync(codec)(archive);
  const part = Option.none();

  const lease = Option.none();

  const started = performance.now();

  const promise = workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Restore,
    part,
    lease,
    init: { method: HttpMethod.Put, headers: { [HttpHeader.ContentType]: MediaType.Json }, body },
  });

  const activated = await capturePromise({ promise });
  const finished = performance.now();
  const milliseconds = finished - started;

  store.recordStartupWork({ machineId, phase: StartupPhase.Restore, milliseconds });

  const progress = await guest.startup({ machineId });
  const now = DateTime.nowUnsafe();

  if (Option.isSome(progress)) {
    store.observeGuestStartup({ machineId, guest: progress.value, now });
  }

  if (Result.isFailure(activated)) {
    store.failStartup({ machineId, failure: StartupFailure.Restore, now });
  }

  const response = Result.getOrThrow(activated);

  return response.status === HttpStatusCode.Ok && isCurrentRestoration({ store, restoration });
}
