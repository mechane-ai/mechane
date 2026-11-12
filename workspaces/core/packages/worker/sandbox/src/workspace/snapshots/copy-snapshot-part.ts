import { HttpMethod, HttpStatusCode } from '@mechane/records';
import type { WorkspaceRestoration, WorkspaceSnapshot } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { GuestConnection, WorkspaceProviderStepInput } from '../../types.ts';
import { workspaceRequest } from '../workspace-request.ts';
import { isCurrentRestoration } from './current-restoration.ts';
import { readSnapshotPart } from './read-snapshot-part.ts';

type CopySnapshotPartInput = WorkspaceProviderStepInput & {
  readonly guest: GuestConnection;
  readonly snapshot: WorkspaceSnapshot;
  readonly restoration: WorkspaceRestoration;
  readonly part: number;
};

/** Copies one immutable part while its original batch retains the restore cursor. */
export async function copySnapshotPart({
  store,
  workspace,
  guest,
  snapshot,
  restoration,
  part,
}: CopySnapshotPartInput): Promise<boolean> {
  const { generation } = snapshot;
  const { machineId } = restoration;
  const body = await readSnapshotPart({ workspace, snapshot, part });
  const selectedPart = Option.some(part);

  if (!isCurrentRestoration({ store, restoration })) {
    return false;
  }

  const lease = Option.none();

  const response = await workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Part,
    part: selectedPart,
    lease,
    init: { method: HttpMethod.Put, body },
  });

  return response.status === HttpStatusCode.Ok;
}
