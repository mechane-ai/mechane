import type { PortableMaintenance } from '@mechane/sandbox-store';
import { SANDBOX_FAILURE_MAX_CHARS, SandboxAction, SandboxPhase } from '@mechane/sandbox-wire';
import type { SandboxReport } from '@mechane/sandbox-wire';
import { capturePromise } from '@mechane/utilities';
import { Option, Result } from 'effect';
import { advancePortableMaintenance } from './advance-portable-maintenance.ts';
import { beginPortableMaintenance } from './begin-portable-maintenance.ts';
import { maintenanceActive } from './maintenance-active.ts';
import { portableReport } from './portable-report.ts';
import { cancelPortableMaintenance } from './steps/cancel-portable-maintenance.ts';
import type { ManagePortableInput } from './types.ts';

export async function managePortable({ store, request, ...resources }: ManagePortableInput): Promise<SandboxReport> {
  const input = { store, request, ...resources };

  if (request.action === SandboxAction.Show || Option.isNone(request.operationId)) {
    return portableReport(input);
  }

  const current = store.portableMaintenance();
  const matching = Option.filter(current, (job) => Option.contains(request.operationId, job.id));

  if (Option.isNone(matching)) {
    const isActive = maintenanceActive({ store });

    if (!isActive && request.action !== SandboxAction.Cancel) {
      beginPortableMaintenance(input);
    }

    return portableReport(input);
  }

  const job = matching.value;

  const promise = advanceMaintenanceRequest({ ...input, job });
  const advanced = await capturePromise({ promise });

  if (Result.isFailure(advanced)) {
    const reason = String(advanced.failure).slice(0, SANDBOX_FAILURE_MAX_CHARS).toWellFormed();
    const lastError = Option.some(reason);

    store.savePortableMaintenance({ ...job, phase: SandboxPhase.Failed, lastError });
  }

  return portableReport(input);
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
