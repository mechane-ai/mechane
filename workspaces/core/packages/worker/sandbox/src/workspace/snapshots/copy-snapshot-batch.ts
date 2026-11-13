import type { WorkspaceRestoration, WorkspaceSnapshot } from '@mechane/sandbox-store';
import { capturePromise } from '@mechane/utilities';
import { Array, Result } from 'effect';
import { WORKSPACE_RESTORE_CONCURRENT_PARTS } from '../../constants.ts';
import type { GuestConnection, WorkspaceProviderStepInput } from '../../types.ts';
import { copySnapshotPart } from './copy-snapshot-part.ts';
import { isCurrentRestoration } from './current-restoration.ts';

type CopySnapshotBatchInput = WorkspaceProviderStepInput & {
  readonly guest: GuestConnection;
  readonly snapshot: WorkspaceSnapshot;
  readonly restoration: WorkspaceRestoration;
};

/** Advances only a complete batch; failed or superseded work leaves the original cursor intact. */
export async function copySnapshotBatch({
  store,
  provider,
  workspace,
  guest,
  snapshot,
  restoration,
}: CopySnapshotBatchInput): Promise<void> {
  const nextPart = Math.min(restoration.part + WORKSPACE_RESTORE_CONCURRENT_PARTS, snapshot.archive.parts);
  const parts = Array.range(restoration.part, nextPart - 1);

  const pending = parts.map((part) =>
    copySnapshotPart({ store, provider, workspace, guest, snapshot, restoration, part }),
  );

  const captured = pending.map((promise) => capturePromise({ promise }));
  const settled = await Promise.all(captured);
  const copied = settled.map(Result.getOrThrow);
  const isComplete = copied.every(Boolean);

  if (isComplete && isCurrentRestoration({ store, restoration })) {
    store.saveRestoration({ ...restoration, part: nextPart });
  }
}
