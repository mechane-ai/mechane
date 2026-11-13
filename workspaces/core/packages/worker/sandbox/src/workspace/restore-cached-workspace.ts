import { MachineStatus } from '@mechane/sandbox-store';
import type { WorkspaceSnapshot } from '@mechane/sandbox-store';
import { StartupPhase, WorkspaceRestoreSource } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import type { MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { verifyGenerationManifest } from './generation-manifest.ts';

type CachedRestoreInput = WorkspaceProviderStepInput &
  MachineIdInput & { readonly snapshot: WorkspaceSnapshot; readonly deadline: DateTime.Utc };

export const CachedRestoreResult = { Miss: 'miss', Restored: 'restored', Blocked: 'blocked' } as const;
type CachedRestoreResult = (typeof CachedRestoreResult)[keyof typeof CachedRestoreResult];

/** A native cache skips archive copying only after the exact committed manifest and live machine agree. */
export async function restoreCachedWorkspace({
  store,
  provider,
  workspace,
  machineId,
  snapshot,
  deadline,
}: CachedRestoreInput): Promise<CachedRestoreResult> {
  const cached = await provider.restoredWorkspace({ machineId, checkpoint: snapshot });

  if (!cached) {
    return CachedRestoreResult.Miss;
  }

  await verifyGenerationManifest({ workspace, snapshot });

  const now = DateTime.nowUnsafe();
  const live = store.liveMachine();
  const state = store.workspace();
  const drain = store.machineDrain({ machineId });
  const starting = Option.exists(live, (value) => value.id === machineId && value.status === MachineStatus.Starting);
  const sameHead = Option.exists(state.head, (value) => value.generation === snapshot.generation);

  const transferring = Option.exists(
    state.restoration,
    (value) =>
      value.machineId === machineId &&
      value.generation === snapshot.generation &&
      value.source === WorkspaceRestoreSource.Archive,
  );

  const isBlocked = Option.isSome(drain) || transferring || DateTime.isGreaterThanOrEqualTo(now, deadline);

  if (!starting || !sameHead || isBlocked) {
    return CachedRestoreResult.Blocked;
  }

  store.saveRestoration({
    machineId,
    generation: snapshot.generation,
    startedAt: now,
    part: 0,
    source: WorkspaceRestoreSource.Native,
  });
  store.observeRestoration({
    machineId,
    restoration: {
      generation: snapshot.generation,
      source: WorkspaceRestoreSource.Native,
      bytes: snapshot.archive.bytes,
      parts: snapshot.archive.parts,
      copiedParts: 0,
    },
    now,
  });
  store.advanceStartup({ machineId, phase: StartupPhase.Restore, now });

  return CachedRestoreResult.Restored;
}
