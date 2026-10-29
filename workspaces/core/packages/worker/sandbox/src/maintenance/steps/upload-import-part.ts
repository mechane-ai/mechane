import { SandboxAction, SandboxPhase } from '@mechane/protocol';
import { Option, Result } from 'effect';
import { Base64 } from 'effect/encoding';
import { PortableMaintenanceRefused } from '../../errors.ts';
import { snapshotPartBytes } from '../../workspace/snapshots/snapshot-part-bytes.ts';
import { workspacePartKey } from '../../workspace/workspace-part-key.ts';
import { maintenanceValue } from '../maintenance-value.ts';
import type { ManagePortableInput, PortableStepInput } from '../types.ts';

type UploadImportPartInput = PortableStepInput & Pick<ManagePortableInput, 'request'>;

/** Advances the upload cursor only after its exact-sized part reaches R2. */
export async function uploadImportPart({ store, workspace, job, request }: UploadImportPartInput): Promise<void> {
  if (job.action !== SandboxAction.Import || job.phase !== SandboxPhase.Copy || request.part !== job.part) {
    return;
  }

  const supplied = Option.fromNullishOr(request.base64);
  const encoded = maintenanceValue({ value: supplied, field: 'base64 part' });
  const decoded = Base64.decode(encoded);
  const body = Result.getOrThrow(decoded);
  const archive = maintenanceValue({ value: job.archive, field: 'archive' });
  const snapshot = { generation: job.generation, archive, parent: Option.none() };
  const expected = snapshotPartBytes({ snapshot, part: job.part });

  if (body.byteLength !== expected) {
    const cause = new PortableMaintenanceRefused({ reason: 'import part has the wrong byte count' });
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  const part = Option.some(job.part);
  const key = workspacePartKey({ owner: workspace.owner, generation: job.generation, part });

  await workspace.bucket.put(key, body, { customMetadata: { archiveSha256: archive.sha256 } });
  store.savePortableMaintenance({ ...job, part: job.part + 1 });
}
