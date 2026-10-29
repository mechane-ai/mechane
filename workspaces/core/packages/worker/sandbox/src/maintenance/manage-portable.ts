import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxReport } from '@mechane/protocol';
import { Option } from 'effect';
import { beginPortableMaintenance } from './begin-portable-maintenance.ts';
import { continuePortableMaintenance } from './continue-portable-maintenance.ts';
import { portableReport } from './portable-report.ts';
import type { ManagePortableInput } from './types.ts';

const START_ACTIONS: ReadonlySet<SandboxAction> = new Set([
  SandboxAction.Export,
  SandboxAction.Import,
  SandboxAction.Upgrade,
  SandboxAction.Delete,
]);

/** Retains one resumable maintenance operation and refuses a competing intent. */
export async function managePortable({ ...input }: ManagePortableInput): Promise<SandboxReport> {
  const { store, request } = input;

  if (request.action === SandboxAction.Show || Option.isNone(request.operationId)) {
    return portableReport(input);
  }

  const current = store.portableMaintenance();
  const matching = Option.filter(current, (job) => Option.contains(request.operationId, job.id));

  if (Option.isNone(matching)) {
    beginRequestedMaintenance(input);

    return portableReport(input);
  }

  return await continuePortableMaintenance({ ...input, job: matching.value });
}

function beginRequestedMaintenance({ ...input }: ManagePortableInput): void {
  const current = input.store.portableMaintenance();
  const isActive = Option.exists(current, (job) => job.phase !== SandboxPhase.Done);

  if (!isActive && START_ACTIONS.has(input.request.action)) {
    beginPortableMaintenance(input);
  }
}
