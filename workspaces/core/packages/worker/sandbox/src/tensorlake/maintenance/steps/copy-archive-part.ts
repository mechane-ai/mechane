import { SandboxPhase } from '@mechane/protocol';
import { HttpHeader, HttpMethod, MediaType } from '@mechane/records';
import { Option } from 'effect';
import { readArchivePart } from '../../../files/read-archive-part.ts';
import { tensorlakeRequest } from '../../tensorlake-request.ts';
import { archivePath } from '../archive-path.ts';
import { fileUrl } from '../file-url.ts';
import { readySandboxOrigin } from '../ready-sandbox-origin.ts';
import type { MaintenanceInput } from '../types.ts';

/** Only one bounded part crosses the Worker per call; replay overwrites the same target part. */
export async function copyArchivePart({ job, apiKey, store }: MaintenanceInput): Promise<void> {
  if (Option.isNone(job.archive) || Option.isNone(job.targetId)) {
    store.saveMaintenance({ ...job, phase: SandboxPhase.Failed });

    return;
  }

  const archive = job.archive.value;
  const targetId = job.targetId.value;

  if (job.part === archive.parts) {
    store.saveMaintenance({ ...job, phase: SandboxPhase.Restore });

    return;
  }

  const source = await readySandboxOrigin({ apiKey, name: job.sourceId });
  const target = await readySandboxOrigin({ apiKey, name: targetId });

  if (Option.isNone(source) || Option.isNone(target)) {
    return;
  }

  const part = Option.some(job.part);
  const path = archivePath({ part });
  const sourceUrl = fileUrl({ origin: source.value, path });
  const targetUrl = fileUrl({ origin: target.value, path });
  const response = await tensorlakeRequest({ apiKey, url: sourceUrl, init: {} });
  const body = await readArchivePart({ response });

  await tensorlakeRequest({
    apiKey,
    url: targetUrl,
    init: { method: HttpMethod.Put, headers: { [HttpHeader.ContentType]: MediaType.OctetStream }, body },
  });

  store.saveMaintenance({ ...job, part: job.part + 1 });
}
