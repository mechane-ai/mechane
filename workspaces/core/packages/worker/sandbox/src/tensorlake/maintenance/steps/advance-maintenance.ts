import { SandboxPhase } from '@mechane/protocol';
import type { MaintenanceInput } from '../types.ts';
import { archiveWorkspace } from './archive-workspace.ts';
import { commitReplacement } from './commit-replacement.ts';
import { copyArchivePart } from './copy-archive-part.ts';
import { createReplacement } from './create-replacement.ts';
import { quiesceWorkspace } from './quiesce-workspace.ts';
import { restoreWorkspace } from './restore-workspace.ts';
import { retireSource } from './retire-source.ts';

/** Every call advances one recorded step; source deletion follows successful restoration and the binding swap. */
export async function advanceMaintenance({ job, ...settings }: MaintenanceInput): Promise<void> {
  switch (job.phase) {
    case SandboxPhase.Quiesce:
      return await quiesceWorkspace({ ...settings, job });
    case SandboxPhase.Archive:
      return await archiveWorkspace({ ...settings, job });
    case SandboxPhase.Create:
      return await createReplacement({ ...settings, job });
    case SandboxPhase.Copy:
      return await copyArchivePart({ ...settings, job });
    case SandboxPhase.Restore:
      return await restoreWorkspace({ ...settings, job });
    case SandboxPhase.Commit:
      return commitReplacement({ ...settings, job });
    case SandboxPhase.Retire:
      return await retireSource({ ...settings, job });
    case SandboxPhase.Idle:
    case SandboxPhase.Done:
    case SandboxPhase.Failed:
      break;
  }
}
