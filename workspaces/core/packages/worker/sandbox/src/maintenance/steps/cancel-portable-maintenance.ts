import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { DateTime, Option } from 'effect';
import { advanceIdleWorkspace } from '../../workspace/advance-idle-workspace.ts';
import type { PortableStepInput } from '../types.ts';

/** Discards only an uncommitted candidate and preserves the previous workspace head. */
export async function cancelPortableMaintenance({ store, provider, workspace, job }: PortableStepInput): Promise<void> {
  if (job.phase === SandboxPhase.Done) {
    return;
  }

  const portable = Option.some(workspace);
  const canStop = await advanceIdleWorkspace({ store, provider, workspace: portable });

  if (!canStop) {
    return;
  }

  if (Option.isSome(job.target)) {
    const machineId = job.target.value;

    const now = DateTime.nowUnsafe();

    store.loseMachine({ machineId, now });
    await provider.stop({ machineId });
  }

  store.retireWorkspace({ generation: job.generation });
  store.savePortableMaintenance({ ...job, action: SandboxAction.Cancel, phase: SandboxPhase.Done });
}
