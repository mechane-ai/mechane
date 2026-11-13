import type { PortableMaintenance } from '@mechane/sandbox-store';
import { SANDBOX_FAILURE_MAX_CHARS, SandboxAction, SandboxPhase } from '@mechane/sandbox-wire';
import type { SandboxReport } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Option, Result, Schema } from 'effect';
import { PortableMaintenanceRefused } from '../errors.ts';
import { environmentReport } from '../inspection/environment-report.ts';
import { advancePortableMaintenance } from './advance-portable-maintenance.ts';
import { beginPortableMaintenance } from './begin-portable-maintenance.ts';
import { maintenanceActive } from './maintenance-active.ts';
import { cancelPortableMaintenance } from './steps/cancel-portable-maintenance.ts';
import type { ManagePortableInput } from './types.ts';

export async function managePortable({ store, request, ...resources }: ManagePortableInput): Promise<SandboxReport> {
  const input = { store, request, ...resources };

  if (request.action === SandboxAction.Show || Option.isNone(request.operationId)) {
    return environmentReport(input);
  }

  const current = store.portableMaintenance();
  const matching = Option.filter(current, (job) => Option.contains(request.operationId, job.id));

  if (Option.isNone(matching)) {
    const isActive = maintenanceActive({ store });

    if (!isActive && request.action !== SandboxAction.Cancel) {
      beginPortableMaintenance(input);
    }

    return environmentReport(input);
  }

  const job = matching.value;

  const promise = advanceMaintenanceRequest({ ...input, job });
  const advanced = await capturePromise({ promise });

  if (Result.isFailure(advanced)) {
    const detail = maintenanceFailureReason({ cause: advanced.failure });
    const reason = detail.slice(0, SANDBOX_FAILURE_MAX_CHARS).toWellFormed();
    const lastError = Option.some(reason);

    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Failed, lastError });
  }

  return environmentReport(input);
}

type MaintenanceFailureInput = { readonly cause: unknown };

function maintenanceFailureReason({ cause }: MaintenanceFailureInput): string {
  if (Schema.is(PortableMaintenanceRefused)(cause)) {
    return cause.reason;
  }

  return String(cause);
}

type MaintenanceRequestInput = ManagePortableInput & { readonly job: PortableMaintenance };

async function advanceMaintenanceRequest({ request, job, ...input }: MaintenanceRequestInput): Promise<void> {
  if (request.action === SandboxAction.Cancel) {
    return await cancelPortableMaintenance({ ...input, job });
  }

  if (job.action === request.action) {
    await advancePortableMaintenance({ ...input, job });
  }
}
