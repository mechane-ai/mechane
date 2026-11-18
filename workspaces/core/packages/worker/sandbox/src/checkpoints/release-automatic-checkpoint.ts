import type { WorkspaceCheckpoint } from '@mechane/sandbox-store';
import { DateTime, Option } from 'effect';
import { AUTOMATIC_CHECKPOINT_QUIET } from '../constants.ts';
import { retiringWorkspace } from '../maintenance/maintenance-active.ts';
import type { ProviderStepInput } from '../types.ts';
import { releaseWorkspaceGeneration } from '../workspace/release-workspace.ts';

type ReleaseAutomaticInput = ProviderStepInput & { readonly checkpoint: WorkspaceCheckpoint };

/** Keep the guest lease across interruptions until its release is acknowledged or the original machine is gone. */
export async function releaseAutomaticCheckpoint({
  store,
  provider,
  checkpoint,
}: ReleaseAutomaticInput): Promise<boolean> {
  if (retiringWorkspace({ store })) {
    return false;
  }

  if (!checkpoint.isAborting) {
    store.saveCheckpoint({ ...checkpoint, isAborting: true });
  }

  const { machineId, generation } = checkpoint;
  const live = store.liveMachine();
  const isOriginal = Option.exists(live, (machine) => machine.id === machineId);
  const isAbsent = !isOriginal && (await provider.isAbsent({ machineId }));

  if (!isAbsent) {
    const guest = await provider.connect({ machineId });

    if (Option.isNone(guest)) {
      return false;
    }

    const lease = Option.some(checkpoint.lease);
    const released = await releaseWorkspaceGeneration({ guest: guest.value, machineId, generation, lease });

    if (!released) {
      return false;
    }
  }

  const state = store.workspace();
  const owned = Option.exists(state.checkpoint, (value) => value.generation === generation && value.isAborting);

  if (!owned || retiringWorkspace({ store })) {
    return false;
  }

  store.atomic({
    run: () => {
      store.retireWorkspace({ generation });

      if (Option.isSome(state.checkpointError)) {
        return;
      }

      const now = DateTime.nowUnsafe();
      const at = DateTime.addDuration(now, AUTOMATIC_CHECKPOINT_QUIET);

      store.scheduleAutomaticCheckpoint({ at, error: state.checkpointError });
    },
  });

  return true;
}
