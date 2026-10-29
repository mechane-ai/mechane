import { SandboxPhase } from '@mechane/protocol';
import { Option } from 'effect';
import type { MaintenanceInput } from '../types.ts';

/** Both writes commit together before another request can retire the source. */
export function commitReplacement({ job, store }: MaintenanceInput): void {
  if (Option.isNone(job.targetId)) {
    store.saveMaintenance({ ...job, phase: SandboxPhase.Failed });

    return;
  }

  store.replaceRemoteSandbox({ sandboxId: job.targetId });
  store.saveMaintenance({ ...job, phase: SandboxPhase.Retire });
}
