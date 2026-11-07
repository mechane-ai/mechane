import { FileCheckpointPurpose, FileCheckpointResult } from '@mechane/sandbox-store';
import { SandboxPhase } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import { runFileCheckpoint } from '../../checkpoints/run-file-checkpoint.ts';
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
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Failed });

    return;
  }

  store.savePortableMaintenance({ ...job, source, phase: SandboxPhase.Create });
}
