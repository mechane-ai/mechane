import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxReport, SandboxRequest } from '@mechane/protocol';
import { Option } from 'effect';
import type { TensorlakeSettings } from '../types.ts';
import { beginMaintenance } from './begin-maintenance.ts';
import { cancelMaintenance } from './cancel-maintenance.ts';
import { downloadArchivePart } from './download-archive-part.ts';
import { maintenanceReport } from './maintenance-report.ts';
import { advanceMaintenance } from './steps/advance-maintenance.ts';

type ManageRemoteInput = TensorlakeSettings & { readonly request: SandboxRequest };

/** A pending operation owns the sandbox until completion or explicit cancellation; retries use its recorded image. */
export async function manageRemote({ request, ...settings }: ManageRemoteInput): Promise<SandboxReport> {
  if (request.action === SandboxAction.Show) {
    return await maintenanceReport(settings);
  }

  if (request.action === SandboxAction.Download) {
    return await downloadArchivePart({ ...settings, request });
  }

  if (request.action === SandboxAction.Cancel) {
    const job = settings.store.maintenance();

    if (Option.isSome(job) && Option.contains(request.operationId, job.value.id)) {
      await cancelMaintenance({ ...settings, job: job.value });
    }

    return await maintenanceReport(settings);
  }

  await changeRemote({ ...settings, request });

  return await maintenanceReport(settings);
}

async function changeRemote({ request, ...settings }: ManageRemoteInput): Promise<void> {
  const previous = settings.store.maintenance();

  if (Option.isNone(previous)) {
    return await beginMaintenance({ ...settings, request });
  }

  const job = previous.value;
  const isSame = Option.contains(request.operationId, job.id);

  if (job.phase === SandboxPhase.Done && !isSame) {
    return await beginMaintenance({ ...settings, request });
  }

  if (isSame && job.action === request.action) {
    await advanceMaintenance({ ...settings, job });
  }
}
