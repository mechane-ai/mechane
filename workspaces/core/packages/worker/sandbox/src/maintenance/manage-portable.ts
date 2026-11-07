import { SandboxAction } from '@mechane/sandbox-wire';
import type { SandboxReport } from '@mechane/sandbox-wire';
import { Option } from 'effect';
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

  if (request.action === SandboxAction.Cancel) {
    await cancelPortableMaintenance({ ...input, job });
  } else if (job.action === request.action) {
    await advancePortableMaintenance({ ...input, job });
  }

  return portableReport(input);
}
