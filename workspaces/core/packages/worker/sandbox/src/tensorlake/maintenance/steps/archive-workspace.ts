import { SANDBOX_ARCHIVE_PART_BYTES, SandboxAction, SandboxArchive, SandboxPhase } from '@mechane/protocol';
import { Option, Schema } from 'effect';
import { tensorlakeAnswer } from '../../tensorlake-answer.ts';
import { tensorlakeRequest } from '../../tensorlake-request.ts';
import { archivePath } from '../archive-path.ts';
import { fileUrl } from '../file-url.ts';
import { readySandboxOrigin } from '../ready-sandbox-origin.ts';
import { runMaintenanceProcess } from '../run-maintenance-process.ts';
import type { MaintenanceInput } from '../types.ts';

/** A failed tar exits before publishing metadata; consumers never mistake a partial archive for a complete one. */
const ARCHIVE_SCRIPT = `set -eu
rm -f "$1".part-* "$1.json"
tar -czf "$1.tar.gz" -C /home/node .
split -b ${SANDBOX_ARCHIVE_PART_BYTES} -d -a 6 "$1.tar.gz" "$1.part-"
bytes=$(stat -c%s "$1.tar.gz")
parts=$(( (bytes + ${SANDBOX_ARCHIVE_PART_BYTES} - 1) / ${SANDBOX_ARCHIVE_PART_BYTES} ))
digest=$(sha256sum "$1.tar.gz")
digest=\u0024{digest%% *}
printf '{"bytes":%s,"parts":%s,"sha256":"%s"}' "$bytes" "$parts" "$digest" > "$1.json"
`;

/** Metadata is published only after tar and splitting succeed. */
export async function archiveWorkspace({ job, ...settings }: MaintenanceInput): Promise<void> {
  const { apiKey, store } = settings;
  const found = await readySandboxOrigin({ apiKey, name: job.sourceId });

  if (Option.isNone(found)) {
    return;
  }

  const part = Option.none<number>();
  const path = archivePath({ part });

  const exitCode = await runMaintenanceProcess({
    apiKey,
    origin: found.value,
    name: `archive-${job.id}`,
    command: ARCHIVE_SCRIPT,
    args: [path],
  });

  if (Option.isNone(exitCode)) {
    return;
  }

  if (exitCode.value !== 0) {
    store.saveMaintenance({ ...job, phase: SandboxPhase.Failed });

    return;
  }

  const url = fileUrl({ origin: found.value, path: `${path}.json` });
  const response = await tensorlakeRequest({ apiKey, url, init: {} });
  const schema = Schema.toType(SandboxArchive);
  const archive = await tensorlakeAnswer({ response, schema });
  const phase = archivePhase({ action: job.action });

  const completed = Option.some(archive);

  store.saveMaintenance({ ...job, archive: completed, phase });
}

type ArchivePhaseInput = { readonly action: SandboxAction };

function archivePhase({ action }: ArchivePhaseInput): SandboxPhase {
  if (action === SandboxAction.Export) {
    return SandboxPhase.Done;
  }

  return SandboxPhase.Create;
}
