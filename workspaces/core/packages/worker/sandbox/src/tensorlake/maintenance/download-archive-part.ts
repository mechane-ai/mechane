import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxReport, SandboxRequest } from '@mechane/protocol';
import type { SandboxMaintenance } from '@mechane/sandbox-store';
import { Equal, Option } from 'effect';
import { Base64 } from 'effect/encoding';
import { readArchivePart } from '../../files/read-archive-part.ts';
import { tensorlakeRequest } from '../tensorlake-request.ts';
import type { TensorlakeSettings } from '../types.ts';
import { archivePath } from './archive-path.ts';
import { fileUrl } from './file-url.ts';
import { maintenanceReport } from './maintenance-report.ts';
import { readySandboxOrigin } from './ready-sandbox-origin.ts';

type DownloadArchivePartInput = TensorlakeSettings & { readonly request: SandboxRequest };

type ReadExportPartInput = DownloadArchivePartInput & {
  readonly job: SandboxMaintenance;
  readonly report: SandboxReport;
};

/** Parts are readable only for the retained export id; a newer operation invalidates that export. */
export async function downloadArchivePart({ request, ...settings }: DownloadArchivePartInput): Promise<SandboxReport> {
  const report = await maintenanceReport(settings);
  const job = settings.store.maintenance();

  if (Option.isNone(job) || !Equal.equals(report.operationId, request.operationId)) {
    return report;
  }

  if (job.value.action !== SandboxAction.Export || job.value.phase !== SandboxPhase.Done) {
    return report;
  }

  return await readExportPart({ ...settings, request, job: job.value, report });
}

async function readExportPart({ request, job, report, apiKey }: ReadExportPartInput): Promise<SandboxReport> {
  if (Option.isNone(job.archive) || request.part >= job.archive.value.parts) {
    return report;
  }

  const remote = await readySandboxOrigin({ apiKey, name: job.sourceId });

  if (Option.isNone(remote)) {
    return report;
  }

  const part = Option.some(request.part);
  const path = archivePath({ part });
  const url = fileUrl({ origin: remote.value, path });
  const response = await tensorlakeRequest({ apiKey, url, init: {} });
  const bytes = await readArchivePart({ response });
  const base64 = Base64.encode(bytes);

  return { ...report, part: request.part, base64: Option.some(base64) };
}
