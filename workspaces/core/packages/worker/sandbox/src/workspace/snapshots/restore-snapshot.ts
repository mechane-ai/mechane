import { HttpHeader, HttpMethod, HttpStatusCode, MediaType } from '@mechane/records';
import type { WorkspaceRestoration, WorkspaceSnapshot } from '@mechane/sandbox-store';
import { SandboxArchive, StartupFailure, StartupPhase, WorkspaceStep } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Array, DateTime, Option, Result, Schema } from 'effect';
import { WORKSPACE_TRANSFER_BATCH_DURATION, WORKSPACE_TRANSFER_BATCH_PARTS } from '../../constants.ts';
import type { GuestConnection, MachineIdInput, WorkspaceProviderStepInput } from '../../types.ts';
import { verifyGenerationManifest } from '../generation-manifest.ts';
import { workspaceRequest } from '../workspace-request.ts';
import { copySnapshotPart } from './copy-snapshot-part.ts';
import { isCurrentRestoration } from './current-restoration.ts';

type RestoreSnapshotInput = WorkspaceProviderStepInput &
  MachineIdInput & { readonly guest: GuestConnection; readonly snapshot: WorkspaceSnapshot };

/** An imported candidate must pass the same bounded guest verification as a committed snapshot. */
export async function restoreSnapshot({
  store,
  provider,
  workspace,
  guest,
  machineId,
  snapshot,
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

  const startedAt = DateTime.nowUnsafe();
  const deadline = DateTime.addDuration(startedAt, WORKSPACE_TRANSFER_BATCH_DURATION);
  const partLimit = Math.min(restored.value.part + WORKSPACE_TRANSFER_BATCH_PARTS, archive.parts);
  const parts = Array.range(restored.value.part, partLimit);

  for (const part of parts) {
    const current = store.workspace().restoration;

    if (Option.isNone(current) || current.value.machineId !== machineId || current.value.generation !== generation) {
      return false;
    }

    if (current.value.part !== part) {
      return false;
    }

    if (part === archive.parts) {
      const now = DateTime.nowUnsafe();

      store.advanceStartup({ machineId, phase: StartupPhase.Restore, now });

      return await activateSnapshot({ store, guest, restoration: current.value, archive });
    }

    const now = DateTime.nowUnsafe();

    if (part === partLimit || DateTime.isGreaterThanOrEqualTo(now, deadline)) {
      return false;
    }

    const started = performance.now();
    const promise = copySnapshotPart({ store, provider, workspace, guest, snapshot, restoration: current.value });
    const copied = await capturePromise({ promise });
    const finished = performance.now();
    const milliseconds = finished - started;
    const copiedAt = DateTime.nowUnsafe();

    store.recordStartupWork({ machineId, phase: StartupPhase.Transfer, milliseconds });

    if (Result.isFailure(copied)) {
      store.failStartup({ machineId, failure: StartupFailure.Restore, now: copiedAt });
    }

    Result.getOrThrow(copied);
    store.observeRestoration({
      machineId,
      restoration: { generation, bytes: archive.bytes, parts: archive.parts, copiedParts: part + 1 },
      now: copiedAt,
    });
  }

  return false;
}

type ActivateSnapshotInput = Pick<RestoreSnapshotInput, 'store' | 'guest'> & {
  readonly restoration: WorkspaceRestoration;
  readonly archive: SandboxArchive;
};

async function activateSnapshot({ store, guest, restoration, archive }: ActivateSnapshotInput): Promise<boolean> {
  const { machineId, generation } = restoration;
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
