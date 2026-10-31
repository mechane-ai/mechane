import { HttpMethod } from '@mechane/records';
import type { WorkspaceRestoration, WorkspaceSnapshot } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { GuestConnection, WorkspaceProviderStepInput } from '../../types.ts';
import { workspaceRequest } from '../workspace-request.ts';
import { readSnapshotPart } from './read-snapshot-part.ts';

type CopySnapshotPartInput = WorkspaceProviderStepInput & {
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
