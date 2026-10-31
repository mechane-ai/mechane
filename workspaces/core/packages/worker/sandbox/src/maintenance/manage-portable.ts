import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxReport } from '@mechane/protocol';
import { Equal, Option, Result } from 'effect';
import { PortableMaintenanceRefused } from '../errors.ts';
import { advancePortableMaintenance } from './advance-portable-maintenance.ts';
import { beginPortableMaintenance } from './begin-portable-maintenance.ts';
import { portableReport } from './portable-report.ts';
import { cancelPortableMaintenance } from './steps/cancel-portable-maintenance.ts';
import { downloadExportPart } from './steps/download-export-part.ts';
import { uploadImportPart } from './steps/upload-import-part.ts';
import type { ManagePortableInput, PortableStepInput } from './types.ts';

type ContinuePortableInput = ManagePortableInput & Pick<PortableStepInput, 'job'>;

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

/** Only the retained operation id may upload, cancel or advance its candidate. */
async function continuePortableMaintenance({ ...input }: ContinuePortableInput): Promise<SandboxReport> {
  const { request } = input;

  if (request.action === SandboxAction.Download) {
    return await downloadExportPart(input);
  }

  if (request.action === SandboxAction.Upload) {
    await uploadImportPart(input);

    return portableReport(input);
  }

  if (request.action === SandboxAction.Cancel) {
    await cancelPortableMaintenance(input);

    return portableReport(input);
  }

  await resumePortableMaintenance(input);

  return portableReport(input);
}

async function resumePortableMaintenance({ ...input }: ContinuePortableInput): Promise<void> {
  const { job, request } = input;

  if (job.action !== request.action) {
    return;
  }

  const supplied = Option.fromNullishOr(request.archive);

  if (job.action === SandboxAction.Import && !Equal.equals(job.archive, supplied)) {
    const cause = new PortableMaintenanceRefused({ reason: 'the import operation already names a different archive' });
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  await advancePortableMaintenance(input);
}
