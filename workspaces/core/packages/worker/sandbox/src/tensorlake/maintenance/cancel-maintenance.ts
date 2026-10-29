import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { Option } from 'effect';
import { sandboxUrl } from '../machines/sandbox-url.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import { archiveSettled } from './archive-settled.ts';
import { advanceMaintenance } from './steps/advance-maintenance.ts';
import type { MaintenanceInput } from './types.ts';

/** Cancellation cannot delete the replacement after it becomes the current workspace. */
export async function cancelMaintenance({ job, ...settings }: MaintenanceInput): Promise<void> {
  if (job.phase === SandboxPhase.Done) {
    return;
  }

  if (job.phase === SandboxPhase.Retire) {
    return await advanceMaintenance({ ...settings, job });
  }

  if (!(await archiveSettled({ ...settings, job }))) {
    return;
  }

  if (job.action === SandboxAction.Upgrade) {
    const replacementName: () => string = () => `foundry-upgrade-${job.id}`;
    const name = Option.getOrElse(job.targetId, replacementName);
    const url = sandboxUrl({ name });

    await tensorlakeRequest({ apiKey: settings.apiKey, url, init: { method: HttpMethod.Delete } });
  }

  settings.store.saveMaintenance({ ...job, phase: SandboxPhase.Done, action: SandboxAction.Cancel });
}
