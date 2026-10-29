import { SandboxAction } from '@mechane/protocol';
import type { WorkspaceSnapshot } from '@mechane/sandbox-store';
import { Option } from 'effect';
import { maintenanceValue } from '../maintenance-value.ts';
import type { PortableStepInput } from '../types.ts';

/** Selects the uncommitted import candidate or the preserved head for a machine replacement. */
export function maintenanceSnapshot({ job }: Pick<PortableStepInput, 'job'>): WorkspaceSnapshot {
  if (job.action !== SandboxAction.Import) {
    return maintenanceValue({ value: job.source, field: 'source' });
  }

  const archive = maintenanceValue({ value: job.archive, field: 'archive' });
  const parent = Option.map(job.source, (snapshot) => snapshot.generation);

  return { generation: job.generation, parent, archive };
}
