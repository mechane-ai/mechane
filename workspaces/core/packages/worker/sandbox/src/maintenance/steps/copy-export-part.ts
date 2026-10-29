import { SandboxPhase } from '@mechane/protocol';
import { Option } from 'effect';
import { readSnapshotPart } from '../../workspace/snapshots/read-snapshot-part.ts';
import { workspacePartKey } from '../../workspace/workspace-part-key.ts';
import { maintenanceValue } from '../maintenance-value.ts';
import type { PortableStepInput } from '../types.ts';

/** The export owns a separate generation so later commands can retire their old heads safely. */
export async function copyExportPart({ store, workspace, job }: PortableStepInput): Promise<void> {
  const snapshot = maintenanceValue({ value: job.source, field: 'source' });

  if (job.part === snapshot.archive.parts) {
    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Done });

    return;
  }

  const body = await readSnapshotPart({ workspace, snapshot, part: job.part });
  const part = Option.some(job.part);
  const key = workspacePartKey({ owner: workspace.owner, generation: job.generation, part });

  await workspace.bucket.put(key, body, { customMetadata: { archiveSha256: snapshot.archive.sha256 } });
  store.savePortableMaintenance({ ...job, part: job.part + 1 });
}
