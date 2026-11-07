import { SandboxPhase } from '@mechane/sandbox-wire';
import { checkpointMaintenance } from './steps/checkpoint-maintenance.ts';
import { commitMaintenance } from './steps/commit-maintenance.ts';
import { deletePortableWorkspace } from './steps/delete-portable-workspace.ts';
import { restoreMaintenance } from './steps/restore-maintenance.ts';
import { startMaintenanceMachine } from './steps/start-maintenance-machine.ts';
import type { PortableStepInput } from './types.ts';

export async function advancePortableMaintenance({ job, ...input }: PortableStepInput): Promise<void> {
  const step = { ...input, job };

  switch (job.phase) {
    case SandboxPhase.Quiesce:
      return await checkpointMaintenance(step);
    case SandboxPhase.Create:
      return await startMaintenanceMachine(step);
    case SandboxPhase.Restore:
      return await restoreMaintenance(step);
    case SandboxPhase.Commit:
      return commitMaintenance(step);
    case SandboxPhase.Retire:
      return await deletePortableWorkspace(step);
    case SandboxPhase.Idle:
    case SandboxPhase.Done:
    case SandboxPhase.Failed:
      break;
  }
}
