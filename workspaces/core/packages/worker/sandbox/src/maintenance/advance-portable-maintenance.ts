import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { maintenanceValue } from './maintenance-value.ts';
import { checkpointMaintenance } from './steps/checkpoint-maintenance.ts';
import { commitMaintenance } from './steps/commit-maintenance.ts';
import { copyExportPart } from './steps/copy-export-part.ts';
import { deletePortableWorkspace } from './steps/delete-portable-workspace.ts';
import { restoreMaintenance } from './steps/restore-maintenance.ts';
import { startMaintenanceMachine } from './steps/start-maintenance-machine.ts';
import type { PortableStepInput } from './types.ts';

/** Advances one durable phase so interruption leaves a resumable operation. */
export async function advancePortableMaintenance({ ...input }: PortableStepInput): Promise<void> {
  const { job } = input;

  switch (job.phase) {
    case SandboxPhase.Quiesce:
      return await checkpointMaintenance(input);
    case SandboxPhase.Copy:
      return await copyMaintenance(input);
    case SandboxPhase.Create:
      return await startMaintenanceMachine(input);
    case SandboxPhase.Restore:
      return await restoreMaintenance(input);
    case SandboxPhase.Commit:
      return commitMaintenance(input);
    case SandboxPhase.Retire:
      return await deletePortableWorkspace(input);
    case SandboxPhase.Idle:
    case SandboxPhase.Archive:
    case SandboxPhase.Done:
    case SandboxPhase.Failed:
      break;
  }
}

async function copyMaintenance({ ...input }: PortableStepInput): Promise<void> {
  const { job, store } = input;

  if (job.action === SandboxAction.Export) {
    return await copyExportPart(input);
  }

  const archive = maintenanceValue({ value: job.archive, field: 'archive' });

  if (job.part === archive.parts) {
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Create });
  }
}
