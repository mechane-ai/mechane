import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import type { SandboxReport } from '@mechane/protocol';
import { Option } from 'effect';
import { Base64 } from 'effect/encoding';
import { readSnapshotPart } from '../../workspace/snapshots/read-snapshot-part.ts';
import { maintenanceValue } from '../maintenance-value.ts';
import { portableReport } from '../portable-report.ts';
import type { ManagePortableInput, PortableStepInput } from '../types.ts';

type DownloadExportPartInput = PortableStepInput & Pick<ManagePortableInput, 'request'>;

/** Reads only the retained export generation so later command checkpoints cannot alter the download. */
export async function downloadExportPart({ ...input }: DownloadExportPartInput): Promise<SandboxReport> {
  const { workspace, job, request } = input;
  const report = portableReport(input);

  if (
    job.action !== SandboxAction.Export ||
    job.phase !== SandboxPhase.Done ||
    !Option.contains(request.operationId, job.id)
  ) {
    return report;
  }

  const archive = maintenanceValue({ value: job.archive, field: 'archive' });

  if (request.part >= archive.parts) {
    return report;
  }

  const snapshot = { generation: job.generation, archive, parent: Option.none() };
  const body = await readSnapshotPart({ workspace, snapshot, part: request.part });
  const bytes = new Uint8Array(body);
  const base64 = Base64.encode(bytes);

  return { ...report, part: request.part, base64: Option.some(base64) };
}
