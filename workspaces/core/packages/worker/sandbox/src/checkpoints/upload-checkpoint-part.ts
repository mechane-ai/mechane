import { HttpMethod } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option, Result } from 'effect';
import { WorkspaceTransferFailed } from '../errors.ts';
import { readArchivePart } from '../files/read-archive-part.ts';
import type { GuestConnection } from '../types.ts';
import { snapshotPartBytes } from '../workspace/snapshots/snapshot-part-bytes.ts';
import { workspacePartKey } from '../workspace/workspace-part-key.ts';
import { workspaceRequest } from '../workspace/workspace-request.ts';
import type { ArchivedCheckpointInput } from './types.ts';

type UploadCheckpointPartInput = ArchivedCheckpointInput & { readonly guest: GuestConnection };

/** Stores one validated archive part with an R2 checksum before advancing the durable cursor. */
export async function uploadCheckpointPart({
  checkpoint,
  archive,
  workspace,
  store,
  guest,
}: UploadCheckpointPartInput): Promise<void> {
  const { generation, part } = checkpoint;
  const bytes = await readCheckpointPart({ checkpoint, archive, guest });
  const selectedPart = Option.some(part);
  const key = workspacePartKey({ owner: workspace.owner, generation, part: selectedPart });
  const sha256 = await crypto.subtle.digest('SHA-256', bytes);

  await workspace.bucket.put(key, bytes, { sha256, customMetadata: { archiveSha256: archive.sha256 } });

  store.saveCheckpoint({ ...checkpoint, part: part + 1 });
}

type ReadCheckpointPartInput = Pick<UploadCheckpointPartInput, 'checkpoint' | 'archive' | 'guest'>;

async function readCheckpointPart({
  checkpoint,
  archive,
  guest,
}: ReadCheckpointPartInput): Promise<Uint8Array<ArrayBuffer>> {
  const { generation, machineId, part } = checkpoint;
  const selectedPart = Option.some(part);
  const snapshot = { generation, parent: checkpoint.parent, archive };

  const response = await workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Part,
    part: selectedPart,
    init: { method: HttpMethod.Get },
  });

  const bytes = await readArchivePart({ response });
  const expected = snapshotPartBytes({ snapshot, part });

  if (bytes.byteLength !== expected) {
    const cause = new WorkspaceTransferFailed({
      generation,
      step: WorkspaceStep.Part,
      reason: 'archive part has the wrong byte count',
    });

    const failure = Result.fail(cause);

    Result.getOrThrow(failure);
  }

  return bytes;
}
