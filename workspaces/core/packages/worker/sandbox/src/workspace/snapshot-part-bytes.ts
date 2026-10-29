import { SANDBOX_ARCHIVE_PART_BYTES } from '@mechane/protocol';
import type { WorkspaceSnapshot } from '@mechane/sandbox-store';

type SnapshotPartInput = { readonly snapshot: WorkspaceSnapshot; readonly part: number };

/** The exact expected byte count of a committed archive part, including the shorter final part. */
export function snapshotPartBytes({ snapshot, part }: SnapshotPartInput): number {
  return Math.min(SANDBOX_ARCHIVE_PART_BYTES, snapshot.archive.bytes - part * SANDBOX_ARCHIVE_PART_BYTES);
}
