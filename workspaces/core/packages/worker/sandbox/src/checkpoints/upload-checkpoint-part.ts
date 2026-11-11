import { HttpMethod } from '@mechane/records';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option, Result } from 'effect';
import { Hex } from 'effect/encoding';
import { WorkspaceTransferFailed } from '../errors.ts';
import { readArchivePart } from '../files/read-archive-part.ts';
import type { GuestConnection } from '../types.ts';
import { snapshotPartBytes } from '../workspace/snapshots/snapshot-part-bytes.ts';
import { workspacePartKey } from '../workspace/workspace-part-key.ts';
import { workspaceRequest } from '../workspace/workspace-request.ts';
import { isCurrentCheckpoint } from './current-checkpoint.ts';
import type { ArchivedCheckpointInput } from './types.ts';

type UploadCheckpointPartInput = ArchivedCheckpointInput & { readonly guest: GuestConnection; readonly part: number };

/** Stores one validated archive part with an R2 checksum under its batch's unchanged checkpoint fence. */
export async function uploadCheckpointPart({
  checkpoint,
  archive,
  workspace,
  store,
  guest,
  part,
}: UploadCheckpointPartInput): Promise<void> {
  const { generation } = checkpoint;
  const bytes = await readCheckpointPart({ checkpoint, archive, guest, part });
  const selectedPart = Option.some(part);
  const key = workspacePartKey({ owner: workspace.owner, generation, part: selectedPart });
  const sha256 = await crypto.subtle.digest('SHA-256', bytes);

  if (!isCurrentCheckpoint({ store, checkpoint })) {
    return;
  }

  const uploaded = await workspace.bucket.put(key, bytes, {
    sha256,
    customMetadata: { archiveSha256: archive.sha256 },
    onlyIf: { etagDoesNotMatch: '*' },
  });

  const stored = Option.fromNullishOr(uploaded);

  if (Option.isSome(stored)) {
    return;
  }

  const found = await workspace.bucket.head(key);
  const existing = Option.fromNullishOr(found);
  const recorded = Option.flatMap(existing, (value) => Option.fromUndefinedOr(value.checksums.sha256));
  const expectedBytes = new Uint8Array(sha256);
  const expected = Hex.encode(expectedBytes);

  const actual = Option.map(recorded, (value) => {
    const digestBytes = new Uint8Array(value);

    return Hex.encode(digestBytes);
  });

  const size = Option.map(existing, (value) => value.size);
  const metadata = Option.flatMap(existing, (value) => Option.fromNullishOr(value.customMetadata));
  const archiveDigest = Option.map(metadata, (value) => value['archiveSha256']);

  const isMatching =
    Option.contains(size, bytes.byteLength) &&
    Option.contains(actual, expected) &&
    Option.contains(archiveDigest, archive.sha256);

  if (isMatching) {
    return;
  }

  const cause = new WorkspaceTransferFailed({
    generation,
    step: WorkspaceStep.Part,
    reason: 'immutable archive part conflicts with its checkpoint',
  });

  const failure = Result.fail(cause);

  Result.getOrThrow(failure);
}

type ReadCheckpointPartInput = Pick<UploadCheckpointPartInput, 'checkpoint' | 'archive' | 'guest' | 'part'>;

async function readCheckpointPart({
  checkpoint,
  archive,
  guest,
  part,
}: ReadCheckpointPartInput): Promise<Uint8Array<ArrayBuffer>> {
  const { generation, machineId } = checkpoint;
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
