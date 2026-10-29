import { SandboxPhase } from '@mechane/protocol';
import { Option } from 'effect';
import { archivePath } from '../archive-path.ts';
import { readySandboxOrigin } from '../ready-sandbox-origin.ts';
import { runMaintenanceProcess } from '../run-maintenance-process.ts';
import type { MaintenanceInput } from '../types.ts';

/** Restore validates the whole transferred archive and then compares every archived entry to the extracted tree. */
const RESTORE_SCRIPT = `set -eu
cat "$1".part-* > "$1.tar.gz"
printf '%s  %s\\n' "$2" "$1.tar.gz" | sha256sum -c -
tar -xzf "$1.tar.gz" -C /home/node
tar -dzf "$1.tar.gz" -C /home/node
rm -f "$1.tar.gz" "$1".part-*
`;

/** The source stays intact until extraction and tar's file comparison both succeed. */
export async function restoreWorkspace({ job, apiKey, store }: MaintenanceInput): Promise<void> {
  if (Option.isNone(job.targetId) || Option.isNone(job.archive)) {
    store.saveMaintenance({ ...job, phase: SandboxPhase.Failed });

    return;
  }

  const targetId = job.targetId.value;
  const found = await readySandboxOrigin({ apiKey, name: targetId });

  if (Option.isNone(found)) {
    return;
  }

  const archive = job.archive.value;
  const part = Option.none<number>();
  const path = archivePath({ part });

  const exitCode = await runMaintenanceProcess({
    apiKey,
    origin: found.value,
    name: `restore-${job.id}`,
    command: RESTORE_SCRIPT,
    args: [path, archive.sha256],
  });

  if (Option.isNone(exitCode)) {
    return;
  }

  if (exitCode.value !== 0) {
    store.saveMaintenance({ ...job, phase: SandboxPhase.Failed });

    return;
  }

  const phase = SandboxPhase.Commit;

  store.saveMaintenance({ ...job, phase });
}
