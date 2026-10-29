import { SandboxPhase } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import { retireWorkspace } from '../../workspace/retire-workspace.ts';
import type { PortableStepInput } from '../types.ts';

/** Retains the deletion intent until all obsolete R2 generations have been removed. */
export async function deletePortableWorkspace({ store, provider, workspace, job }: PortableStepInput): Promise<void> {
  const latest = store.latestMachine();

  if (Option.isSome(latest)) {
    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId: latest.value.id, now });
    await provider.stop({ machineId: latest.value.id });
  }

  const head = store.workspace().head;

  const clear: () => void = () => {
    if (Option.isSome(head)) {
      store.retireWorkspace({ generation: head.value.generation });
    }

    store.clearWorkspace();
  };

  store.atomic({ run: clear });
  await retireWorkspace({ store, workspace });

  const retired = store.workspace().retired;

  if (Option.isNone(retired)) {
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Done });
  }
}
