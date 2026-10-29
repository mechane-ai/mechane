import { SandboxAction } from '@mechane/protocol';
import type { SandboxReport } from '@mechane/protocol';
import { Equal, Option, Result } from 'effect';
import { PortableMaintenanceRefused } from '../errors.ts';
import { advancePortableMaintenance } from './advance-portable-maintenance.ts';
import { portableReport } from './portable-report.ts';
import { cancelPortableMaintenance } from './steps/cancel-portable-maintenance.ts';
import { downloadExportPart } from './steps/download-export-part.ts';
import { uploadImportPart } from './steps/upload-import-part.ts';
import type { ManagePortableInput, PortableStepInput } from './types.ts';

type ContinuePortableInput = ManagePortableInput & Pick<PortableStepInput, 'job'>;

/** Only the retained operation id may upload, cancel or advance its candidate. */
export async function continuePortableMaintenance({ ...input }: ContinuePortableInput): Promise<SandboxReport> {
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
