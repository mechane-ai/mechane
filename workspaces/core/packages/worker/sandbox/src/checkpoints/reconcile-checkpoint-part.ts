import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option, Result } from 'effect';
import { WorkspaceTransferFailed } from '../errors.ts';
import { snapshotPartBytes } from '../workspace/snapshot-part-bytes.ts';
import { workspacePartKey } from '../workspace/workspace-part-key.ts';
import type { ArchivedCheckpointInput } from './types.ts';

/** A successful upload may have lost its response before the cursor advanced. */
export async function reconcileCheckpointPart({
  checkpoint,
  archive,
  workspace,
  store,
}: ArchivedCheckpointInput): Promise<boolean> {
  const { generation, parent, part } = checkpoint;
  const selectedPart = Option.some(part);
  const key = workspacePartKey({ owner: workspace.owner, generation, part: selectedPart });
  const found = await workspace.bucket.head(key);
  const object = Option.fromNullishOr(found);

  if (Option.isNone(object)) {
    return false;
  }

  const expected = snapshotPartBytes({ snapshot: { generation, parent, archive }, part });

  const metadata = Option.fromNullishOr(object.value.customMetadata);
  const digest = Option.map(metadata, (value) => value['archiveSha256']);

  if (object.value.size !== expected || !Option.contains(digest, archive.sha256)) {
    const cause = new WorkspaceTransferFailed({
      generation,
      step: WorkspaceStep.Part,
      reason: 'stored archive part does not match its generation',
    });

    const failure = Result.fail(cause);

    Result.getOrThrow(failure);
  }

  store.saveCheckpoint({ ...checkpoint, part: part + 1 });

  return true;
}
