import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import { SandboxPhase } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import { retireWorkspace } from '../../workspace/retire-workspace.ts';
import type { PortableStepInput } from '../types.ts';

/** Retains the deletion intent until all obsolete R2 generations have been removed. */
export async function deletePortableWorkspace({ store, provider, workspace, job }: PortableStepInput): Promise<void> {
  const checkpoint = store.workspace().checkpoint;
  const isRequired = Option.exists(checkpoint, (value) => !FileCheckpointPurpose.guards.Automatic(value.purpose));

  if (isRequired) {
    return;
  }

  const latest = store.latestMachine();
  const now = DateTime.nowUnsafe();

  store.atomic({
    run: () => {
      if (Option.isSome(latest)) {
        store.loseMachine({ machineId: latest.value.id, now });
      }

      if (Option.isSome(checkpoint)) {
        store.retireWorkspace({ generation: checkpoint.value.generation });
      }
    },
  });

  if (Option.isSome(latest)) {
    const cacheCheckpoint = Option.none();

    await provider.stop({ machineId: latest.value.id, checkpoint: cacheCheckpoint });
  }

  const head = store.workspace().head;

  const clear: () => void = () => {
    if (Option.isSome(head)) {
      store.retireWorkspace({ generation: head.value.generation });
    }

    store.retireRestoreArtifacts();
    store.clearWorkspace();
  };

  store.atomic({ run: clear });
  await retireWorkspace({ store, workspace });

  const retired = store.workspace().retired;

  if (Option.isNone(retired)) {
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Done });
  }
}
