import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import { AUTOMATIC_CHECKPOINT_QUIET } from '../constants.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { releaseWorkspaceGeneration } from './release-workspace.ts';

type AdvanceWorkspaceInput = WorkspaceProviderStepInput & { readonly shouldAdmitCommand: boolean };

/** Required barriers retain admission; an immutable automatic archive uploads independently of live commands. */
export async function advanceWorkspace({
  store,
  provider,
  shouldAdmitCommand,
}: AdvanceWorkspaceInput): Promise<boolean> {
  const state = store.workspace();

  if (Option.isSome(state.recovery)) {
    return false;
  }

  const checkpoint = state.checkpoint;

  if (Option.isNone(checkpoint)) {
    return true;
  }

  if (!shouldAdmitCommand || !FileCheckpointPurpose.guards.Automatic(checkpoint.value.purpose)) {
    return false;
  }

  if (Option.isSome(checkpoint.value.archive) && !checkpoint.value.isAborting) {
    return true;
  }

  // Retiring the capture fence first prevents a delayed metadata response from starting an upload.
  store.saveCheckpoint({ ...checkpoint.value, isAborting: true });

  const guest = await provider.connect({ machineId: checkpoint.value.machineId });

  if (Option.isNone(guest)) {
    return false;
  }

  const lease = Option.some(checkpoint.value.lease);

  const released = await releaseWorkspaceGeneration({
    guest: guest.value,
    machineId: checkpoint.value.machineId,
    generation: checkpoint.value.generation,
    lease,
  });

  if (!released) {
    return false;
  }

  const current = store.workspace().checkpoint;

  if (Option.exists(current, (value) => value.generation === checkpoint.value.generation && value.isAborting)) {
    const now = DateTime.nowUnsafe();
    const at = DateTime.addDuration(now, AUTOMATIC_CHECKPOINT_QUIET);

    store.retireWorkspace({ generation: checkpoint.value.generation });

    const error = store.workspace().checkpointError;

    store.scheduleAutomaticCheckpoint({ at, error });
  }

  return true;
}
