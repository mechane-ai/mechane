import { NativeSnapshotId } from '@mechane/records';
import { machineCacheRecords, WorkspaceSnapshot } from '@mechane/sandbox-store';
import type { MachineCacheSnapshot } from '@mechane/sandbox-store';
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
};

/** Native images cache a frozen committed home; the portable manifest remains its authority. */
export function containerWorkspaceCache({
  container,
  storage,
  nativeImage,
  instance,
  configuration,
}: CacheInput): WorkspaceCache {
  const records = machineCacheRecords({ storage });
  const configurationKey = JSON.stringify({ image: nativeImage, instance, ...configuration });

  async function key({ checkpoint }: MachineCheckpointInput): Promise<string> {
    const encoded = Schema.encodeSync(WorkspaceSnapshot)(checkpoint);
    const json = JSON.stringify({ configurationKey, checkpoint: encoded });
    const bytes = new TextEncoder().encode(json);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const value = new Uint8Array(digest);

    return Hex.encode(value);
  }

  async function select({ machineId, checkpoint }: MachineStartInput): Promise<Option.Option<MachineCacheSnapshot>> {
    const cached = await records.readCache();
    const now = DateTime.nowUnsafe();

    if (
      Option.isNone(checkpoint) ||
      Option.isNone(cached) ||
      DateTime.isGreaterThanOrEqualTo(now, cached.value.expiresAt)
    ) {
      return Option.none();
    }

    const expected = await key({ machineId, checkpoint: checkpoint.value });

    return Option.filter(cached, (value) => value.key === expected);
  }

  async function startup({ machineId, checkpoint }: MachineStartInput): Promise<ContainerStartupOptions> {
    if (Option.isNone(nativeImage)) {
      return {};
    }

    const selected = await select({ machineId, checkpoint });
    const selectedKey = Option.map(selected, (value) => value.key);

    await records.saveSelection({ value: { machineId, configuration: configurationKey, key: selectedKey } });

    if (Option.isSome(selected)) {
      return { containerSnapshot: { id: selected.value.snapshotId }, instance };
    }

    return { image: nativeImage.value, instance };
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
    if (
      Option.isNone(nativeImage) ||
      Option.isNone(checkpoint.manifestSha256) ||
      !Option.contains(checkpoint.capturedMachineId, machineId)
    ) {
      return;
    }

    const active = await records.readSelection();
    const isRunning = await requireContainerMachine({ container, machineId });

    if (Option.isNone(active) || !isRunning) {
      return;
    }

    const isSameConfiguration = active.value.configuration === configurationKey;

    if (active.value.machineId !== machineId || !isSameConfiguration) {
      return;
    }

    const expected = await key({ machineId, checkpoint });
    const started = performance.now();
    const promise = container.snapshotContainer({ name: checkpoint.generation });
    const result = await captureBefore({ promise, span: CAPTURE_TIMEOUT });

    if (Option.isNone(result)) {
      writeWorkspaceCacheFailed({ machineId });

      return;
    }

    const snapshot = Result.getOrThrow(result.value);
    const now = DateTime.nowUnsafe();
    const expiresAt = DateTime.addDuration(now, CACHE_LIFETIME);
    const snapshotId = NativeSnapshotId.make(snapshot.id);

    await records.saveCache({ value: { key: expected, snapshotId, bytes: snapshot.size, expiresAt } });

    const elapsedMs = performance.now() - started;
    const elapsed = Duration.millis(elapsedMs);

    writeWorkspaceCacheSaved({ machineId, bytes: snapshot.size, elapsed });
  }

  async function capture({ machineId, checkpoint }: MachineCheckpointInput): Promise<void> {
    const promise = captureCheckpoint({ machineId, checkpoint });
    const result = await capturePromise({ promise });

    if (Result.isFailure(result)) {
      writeWorkspaceCacheFailed({ machineId });
    }
  }

  return { startup, restoredWorkspace, capture, invalidateSelected: records.invalidateSelected };
}
