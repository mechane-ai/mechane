import { NativeSnapshotId } from '@mechane/records';
import { machineCacheRecords, WorkspaceSnapshot } from '@mechane/sandbox-store';
import type { MachineCacheSnapshot } from '@mechane/sandbox-store';
import { NativeSnapshotCaptureStatus, NativeSnapshotSelection } from '@mechane/sandbox-wire';
import type { NativeSnapshotCapture, NativeSnapshotReport } from '@mechane/sandbox-wire';
import { captureBefore, capturePromise } from '@mechane/utilities';
import { DateTime, Duration, Option, Result, Schema } from 'effect';
import { Hex } from 'effect/encoding';
import { writeWorkspaceCacheFailed, writeWorkspaceCacheSaved } from '../output/write-sandbox-diagnostic.ts';
import type { MachineCheckpointInput, MachineIdInput, MachineStartInput } from '../types.ts';
import { requireContainerMachine } from './container-machine.ts';
import type { ContainerProviderInput } from './types.ts';

const CACHE_LIFETIME = Duration.days(29);
const CAPTURE_TIMEOUT = Duration.minutes(1);

type CacheInput = Pick<ContainerProviderInput, 'container' | 'nativeImage' | 'instance'> & {
  readonly storage: ContainerProviderInput['state']['storage'];
  readonly waitUntil: ContainerProviderInput['state']['waitUntil'];
  readonly configuration: Pick<
    ContainerProviderInput,
    'additionalTools' | 'isBrowserSandboxDisabled' | 'trustedCertificatesPem' | 'containerNetwork'
  >;
};

type WorkspaceCache = {
  readonly startup: (input: MachineStartInput) => Promise<ContainerStartupOptions>;
  readonly restoredWorkspace: (input: MachineCheckpointInput) => Promise<boolean>;
  readonly capture: (input: MachineCheckpointInput) => Promise<void>;
  readonly invalidateSelected: (input: MachineIdInput) => Promise<void>;
  readonly rejected: (input: MachineIdInput) => Promise<ContainerStartupOptions>;
  readonly report: (input: MachineIdInput) => Promise<Option.Option<NativeSnapshotReport>>;
};

type Selection = { readonly status: NativeSnapshotSelection; readonly snapshot: Option.Option<MachineCacheSnapshot> };
type SaveReportInput = { readonly value: NativeSnapshotReport };
type InvalidateInput = MachineIdInput & { readonly status: NativeSnapshotSelection };
type CaptureObservationInput = { readonly observation: NativeSnapshotCapture };

/** Native images cache a frozen committed home; the portable manifest remains its authority. */
export function containerWorkspaceCache({
  container,
  storage,
  waitUntil,
  nativeImage,
  instance,
  configuration,
}: CacheInput): WorkspaceCache {
  const records = machineCacheRecords({ storage });
  const configurationKey = JSON.stringify({ image: nativeImage, instance, ...configuration });

  async function readReport(): Promise<Option.Option<NativeSnapshotReport>> {
    const promise = records.readReport();
    const result = await capturePromise({ promise });

    return Result.getOrElse(result, () => Option.none());
  }

  async function saveReport({ value }: SaveReportInput): Promise<void> {
    const promise = records.saveReport({ value });

    await capturePromise({ promise });
  }

  async function key({ checkpoint }: MachineCheckpointInput): Promise<string> {
    const encoded = Schema.encodeSync(WorkspaceSnapshot)(checkpoint);
    const json = JSON.stringify({ configurationKey, checkpoint: encoded });
    const bytes = new TextEncoder().encode(json);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const value = new Uint8Array(digest);

    return Hex.encode(value);
  }

  async function select({ machineId, checkpoint }: MachineStartInput): Promise<Selection> {
    const missing = Option.none<MachineCacheSnapshot>();

    if (Option.isNone(nativeImage)) {
      return { status: NativeSnapshotSelection.Unavailable, snapshot: missing };
    }

    if (Option.isNone(checkpoint)) {
      return { status: NativeSnapshotSelection.NoCheckpoint, snapshot: missing };
    }

    const cached = await records.readCache();

    if (Option.isNone(cached)) {
      return { status: NativeSnapshotSelection.Missing, snapshot: missing };
    }

    const expected = await key({ machineId, checkpoint: checkpoint.value });
    const now = DateTime.nowUnsafe();

    if (DateTime.isGreaterThanOrEqualTo(now, cached.value.expiresAt)) {
      return { status: NativeSnapshotSelection.Expired, snapshot: missing };
    }

    if (cached.value.key !== expected) {
      return { status: NativeSnapshotSelection.Incompatible, snapshot: missing };
    }

    return { status: NativeSnapshotSelection.Selected, snapshot: cached };
  }

  async function startup({ machineId, checkpoint }: MachineStartInput): Promise<ContainerStartupOptions> {
    const selected = await select({ machineId, checkpoint });
    const selectedKey = Option.map(selected.snapshot, (value) => value.key);
    const previous = await readReport();
    const lastCapture = Option.flatMap(previous, (value) => value.capture);
    const selectedAt = DateTime.nowUnsafe();

    await records.saveSelection({ value: { machineId, configuration: configurationKey, key: selectedKey } });
    await saveReport({ value: { machineId, selection: selected.status, selectedAt, capture: lastCapture } });

    if (Option.isSome(selected.snapshot)) {
      return { containerSnapshot: { id: selected.snapshot.value.snapshotId }, instance };
    }

    if (Option.isNone(nativeImage)) {
      return {};
    }

    return { image: nativeImage.value, instance };
  }

  async function report({ machineId }: MachineIdInput): Promise<Option.Option<NativeSnapshotReport>> {
    const found = await readReport();

    return Option.filter(found, (value) => value.machineId === machineId);
  }

  async function invalidate({ machineId, status }: InvalidateInput): Promise<void> {
    await records.invalidateSelected({ machineId });

    const active = await records.readSelection();

    if (Option.isSome(active) && active.value.machineId === machineId) {
      const empty = Option.none();

      await records.saveSelection({ value: { ...active.value, key: empty } });
    }

    const observed = await report({ machineId });

    if (Option.isSome(observed) && observed.value.selection === NativeSnapshotSelection.Selected) {
      await saveReport({ value: { ...observed.value, selection: status } });
    }
  }

  async function rejected({ machineId }: MachineIdInput): Promise<ContainerStartupOptions> {
    await invalidate({ machineId, status: NativeSnapshotSelection.Rejected });

    if (Option.isNone(nativeImage)) {
      return {};
    }

    return { image: nativeImage.value, instance };
  }

  async function recordCapture({ observation }: CaptureObservationInput): Promise<void> {
    const promise = records.saveCapture({ observation });

    await capturePromise({ promise });
  }

  async function restoredWorkspace({ machineId, checkpoint }: MachineCheckpointInput): Promise<boolean> {
    if (Option.isNone(nativeImage)) {
      return false;
    }

    const active = await records.readSelection();
    const expected = await key({ machineId, checkpoint });

    if (Option.isNone(active) || active.value.machineId !== machineId || !Option.contains(active.value.key, expected)) {
      return false;
    }

    return await requireContainerMachine({ container, machineId });
  }

  async function captureCheckpoint({ machineId, checkpoint }: MachineCheckpointInput): Promise<void> {
    if (Option.isNone(nativeImage)) {
      return;
    }

    const started = performance.now();
    const at = DateTime.nowUnsafe();
    const empty = Option.none();

    const observation: NativeSnapshotCapture = {
      machineId,
      generation: checkpoint.generation,
      status: NativeSnapshotCaptureStatus.Capturing,
      at,
      bytes: empty,
      duration: empty,
    };

    if (Option.isNone(checkpoint.manifestSha256) || !Option.contains(checkpoint.capturedMachineId, machineId)) {
      await recordCapture({ observation: { ...observation, status: NativeSnapshotCaptureStatus.Uncommitted } });

      return;
    }

    const active = await records.readSelection();
    const isRunning = await requireContainerMachine({ container, machineId });

    if (Option.isNone(active) || !isRunning || active.value.machineId !== machineId) {
      await recordCapture({ observation: { ...observation, status: NativeSnapshotCaptureStatus.MachineChanged } });

      return;
    }

    const isSameConfiguration = active.value.configuration === configurationKey;

    if (!isSameConfiguration) {
      await recordCapture({
        observation: { ...observation, status: NativeSnapshotCaptureStatus.ConfigurationChanged },
      });

      return;
    }

    const expected = await key({ machineId, checkpoint });

    await recordCapture({ observation });

    const promise = completeCapture();

    waitUntil(promise);

    const result = await captureBefore({ promise, span: CAPTURE_TIMEOUT });
    const captureMilliseconds = performance.now() - started;
    const captureDuration = Duration.millis(captureMilliseconds);
    const duration = Option.some(captureDuration);

    if (Option.isNone(result)) {
      await recordCapture({ observation: { ...observation, status: NativeSnapshotCaptureStatus.TimedOut, duration } });
      writeWorkspaceCacheFailed({ machineId, status: NativeSnapshotCaptureStatus.TimedOut });

      return;
    }

    Result.getOrThrow(result.value);

    async function completeCapture(): Promise<void> {
      const completion = saveSnapshot();
      const completed = await capturePromise({ promise: completion });

      if (Result.isSuccess(completed)) {
        return;
      }

      const elapsedMilliseconds = performance.now() - started;
      const elapsed = Duration.millis(elapsedMilliseconds);
      const failedDuration = Option.some(elapsed);

      await recordCapture({
        observation: { ...observation, status: NativeSnapshotCaptureStatus.Failed, duration: failedDuration },
      });
      writeWorkspaceCacheFailed({ machineId, status: NativeSnapshotCaptureStatus.Failed });
    }

    async function saveSnapshot(): Promise<void> {
      const snapshot = await container.snapshotContainer({ name: checkpoint.generation });
      const now = DateTime.nowUnsafe();
      const expiresAt = DateTime.addDuration(now, CACHE_LIFETIME);
      const snapshotId = NativeSnapshotId.make(snapshot.id);

      const saved = await records.saveCache({
        machineId,
        configuration: configurationKey,
        value: { key: expected, snapshotId, bytes: snapshot.size, capturedAt: at, expiresAt },
      });

      const elapsedMilliseconds = performance.now() - started;
      const elapsed = Duration.millis(elapsedMilliseconds);
      const recordedDuration = Option.some(elapsed);

      if (!saved) {
        await recordCapture({
          observation: {
            ...observation,
            status: NativeSnapshotCaptureStatus.MachineChanged,
            duration: recordedDuration,
          },
        });

        return;
      }

      const bytes = Option.some(snapshot.size);

      await recordCapture({
        observation: { ...observation, status: NativeSnapshotCaptureStatus.Saved, duration: recordedDuration, bytes },
      });
      writeWorkspaceCacheSaved({ machineId, bytes: snapshot.size, elapsed });
    }
  }

  async function capture({ machineId, checkpoint }: MachineCheckpointInput): Promise<void> {
    const started = performance.now();
    const promise = captureCheckpoint({ machineId, checkpoint });
    const result = await capturePromise({ promise });

    if (Result.isSuccess(result)) {
      return;
    }

    const milliseconds = performance.now() - started;
    const elapsed = Duration.millis(milliseconds);
    const duration = Option.some(elapsed);

    const observation: NativeSnapshotCapture = {
      machineId,
      generation: checkpoint.generation,
      status: NativeSnapshotCaptureStatus.Failed,
      at: DateTime.nowUnsafe(),
      bytes: Option.none(),
      duration,
    };

    const recording = recordCapture({ observation });

    await capturePromise({ promise: recording });
    writeWorkspaceCacheFailed({ machineId, status: NativeSnapshotCaptureStatus.Failed });
  }

  return {
    startup,
    restoredWorkspace,
    capture,
    rejected,
    report,
    invalidateSelected: ({ machineId }) => invalidate({ machineId, status: NativeSnapshotSelection.Exited }),
  };
}
