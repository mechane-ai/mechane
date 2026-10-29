import { RecordId } from '@mechane/records';
import type { WorkspaceSnapshot } from '@mechane/sandbox-store';
import { Option, Result, Schema } from 'effect';
import type { WorkspaceFiles } from '../../types.ts';
import { workspacePartKey } from '../workspace-part-key.ts';
import { snapshotPartBytes } from './snapshot-part-bytes.ts';

/** A committed snapshot part is absent or has inconsistent size or metadata. */
class WorkspaceSnapshotMissing extends Schema.TaggedError<WorkspaceSnapshotMissing>()('WorkspaceSnapshotMissing', {
  generation: RecordId,
  part: Schema.Int,
}) {}

type ReadSnapshotPartInput = {
  readonly workspace: WorkspaceFiles;
  readonly snapshot: WorkspaceSnapshot;
  readonly part: number;
};

/** Rejects missing parts or mismatched metadata before sending bytes to a fresh guest. */
export async function readSnapshotPart({ workspace, snapshot, part }: ReadSnapshotPartInput): Promise<ArrayBuffer> {
  const { generation, archive } = snapshot;
  const selectedPart = Option.some(part);
  const key = workspacePartKey({ owner: workspace.owner, generation, part: selectedPart });
  const found = await workspace.bucket.get(key);
  const object = Option.fromNullishOr(found);
  const expected = snapshotPartBytes({ snapshot, part });
  const metadata = Option.flatMap(object, (value) => Option.fromNullishOr(value.customMetadata));
  const digest = Option.map(metadata, (value) => value['archiveSha256']);

  if (Option.isNone(object) || object.value.size !== expected || !Option.contains(digest, archive.sha256)) {
    const cause = new WorkspaceSnapshotMissing({ generation, part });
    const failure = Result.fail(cause);

    return Result.getOrThrow(failure);
  }

  return await object.value.arrayBuffer();
}
