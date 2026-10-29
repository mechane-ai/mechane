import { HttpMethod, RecordId } from '@mechane/records';
import type { WorkspaceRestoration, WorkspaceSnapshot } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option, Result, Schema } from 'effect';
import type { GuestConnection, WorkspaceTransferInput } from '../types.ts';
import { snapshotPartBytes } from './snapshot-part-bytes.ts';
import { workspacePartKey } from './workspace-part-key.ts';
import { workspaceRequest } from './workspace-request.ts';

/** A committed snapshot part is absent or has inconsistent size or metadata. */
class WorkspaceSnapshotMissing extends Schema.TaggedError<WorkspaceSnapshotMissing>()('WorkspaceSnapshotMissing', {
  generation: RecordId,
  part: Schema.Int,
}) {}

type CopySnapshotPartInput = WorkspaceTransferInput & {
  readonly guest: GuestConnection;
  readonly snapshot: WorkspaceSnapshot;
  readonly restoration: WorkspaceRestoration;
};

/** Copies one committed R2 part to a replacement guest before advancing its restore cursor. */
export async function copySnapshotPart({
  store,
  workspace,
  guest,
  snapshot,
  restoration,
}: CopySnapshotPartInput): Promise<void> {
  const { generation } = snapshot;
  const { part, machineId } = restoration;
  const body = await readSnapshotPart({ workspace, snapshot, part });
  const selectedPart = Option.some(part);

  await workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Part,
    part: selectedPart,
    init: { method: HttpMethod.Put, body },
  });

  store.saveRestoration({ ...restoration, part: part + 1 });
}

type ReadSnapshotPartInput = Pick<CopySnapshotPartInput, 'workspace' | 'snapshot'> & { readonly part: number };

async function readSnapshotPart({ workspace, snapshot, part }: ReadSnapshotPartInput): Promise<ArrayBuffer> {
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
