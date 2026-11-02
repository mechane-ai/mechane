import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { Option, Result } from 'effect';
import { runFileCheckpoint } from '../../checkpoints/run-file-checkpoint.ts';
import { PortableMaintenanceRefused } from '../../errors.ts';
import type { PortableStepInput } from '../types.ts';

/** A maintenance operation commits files before copying or replacing its source generation. */
export async function checkpointMaintenance({ store, provider, workspace, job }: PortableStepInput): Promise<void> {
  const purpose = FileCheckpointPurpose.cases.Maintenance.make({ operationId: job.id });
  const progress = await runFileCheckpoint({ store, provider, workspace, purpose });

  if (FileCheckpointResult.guards.Pending(progress)) {
    return;
  }

  const source = store.workspace().head;

  if (!FileCheckpointResult.guards.Committed(progress) || Option.isNone(source)) {
    const cause = new PortableMaintenanceRefused({ reason: 'maintenance could not commit the current workspace' });
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  const archive = Option.some(source.value.archive);

  if (job.action === SandboxAction.Export) {
    store.savePortableMaintenance({ ...job, source, archive, phase: SandboxPhase.Copy });

    return;
  }

  store.savePortableMaintenance({ ...job, source, archive, phase: SandboxPhase.Create });
}
