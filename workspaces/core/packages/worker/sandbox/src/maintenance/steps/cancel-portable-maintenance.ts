import { SandboxAction, SandboxPhase } from '@mechane/sandbox-wire';
import { DateTime, Option } from 'effect';
import type { PortableStepInput } from '../types.ts';

/** Discards only an uncommitted candidate and preserves the previous workspace head. */
export async function cancelPortableMaintenance({ store, provider, job }: PortableStepInput): Promise<void> {
  if (job.phase === SandboxPhase.Done) {
    return;
  }

  if (Option.isSome(job.target)) {
    const machineId = job.target.value;

    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });
    await provider.stop({ machineId });

    const restoration = store.workspace().restoration;
    const source = job.source;

    if (Option.isSome(restoration) && Option.isSome(source)) {
      const matches =
        restoration.value.machineId === machineId && restoration.value.generation === source.value.generation;

      if (matches) {
        store.clearRestoration(restoration.value);
      }
    }
  }

  store.savePortableMaintenance({ ...job, action: SandboxAction.Cancel, phase: SandboxPhase.Done });
}
