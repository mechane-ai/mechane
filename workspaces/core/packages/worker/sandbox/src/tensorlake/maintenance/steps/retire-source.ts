import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { HttpMethod } from '@mechane/records';
import { Option } from 'effect';
import { sandboxUrl } from '../../machines/sandbox-url.ts';
import { tensorlakeRequest } from '../../tensorlake-request.ts';
import type { MaintenanceInput } from '../types.ts';

/** Deletion retries the recorded source, never the replacement that now holds the files. */
export async function retireSource({ job, apiKey, store }: MaintenanceInput): Promise<void> {
  const url = sandboxUrl({ name: job.sourceId });

  await tensorlakeRequest({ apiKey, url, init: { method: HttpMethod.Delete } });

  if (job.action === SandboxAction.Delete) {
    const sandboxId = Option.none();

    store.replaceRemoteSandbox({ sandboxId });
  }

  store.saveMaintenance({ ...job, phase: SandboxPhase.Done });
}
