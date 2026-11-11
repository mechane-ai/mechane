import { HttpMethod, HttpStatusCode } from '@mechane/records';
import type { RecordId } from '@mechane/records';
import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import { WorkspaceStep } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { GuestConnection, MachineIdInput, WorkspaceProviderStepInput } from '../types.ts';
import { workspaceRequest } from './workspace-request.ts';

type ReleaseWorkspaceInput = WorkspaceProviderStepInput & {
  readonly guest: GuestConnection;
  readonly machineId: MachineIdInput['machineId'];
};

/** Releases the committed or failed generation while preserving the guest home files. */
export async function releaseWorkspace({ store, guest, machineId }: ReleaseWorkspaceInput): Promise<boolean> {
  if (hasCapturedAutomaticCheckpoint({ store, machineId })) {
    return true;
  }

  const state = store.workspace();
  const recovery = Option.filter(state.recovery, (value) => value.machineId === machineId);
  const head = Option.orElse(recovery, () => state.head);

  if (Option.isNone(head)) {
    return true;
  }

  const lease = Option.none();

  return await releaseWorkspaceGeneration({ guest, machineId, generation: head.value.generation, lease });
}

/** An immutable automatic upload owns its guest scratch until its transfers settle. */
export function hasCapturedAutomaticCheckpoint({
  store,
  machineId,
}: Pick<ReleaseWorkspaceInput, 'store' | 'machineId'>): boolean {
  const active = store.workspace().checkpoint;

  return Option.exists(active, (value) => {
    const isOwned = value.machineId === machineId && !value.isAborting;

    return isOwned && FileCheckpointPurpose.guards.Automatic(value.purpose) && Option.isSome(value.archive);
  });
}

type ReleaseGenerationInput = {
  readonly guest: GuestConnection;
  readonly machineId: MachineIdInput['machineId'];
  readonly generation: RecordId;
  readonly lease: Option.Option<number>;
};

/** An acknowledged release drops one known generation's scratch and fence, preserving the guest home. */
export async function releaseWorkspaceGeneration({
  guest,
  machineId,
  generation,
  lease,
}: ReleaseGenerationInput): Promise<boolean> {
  const part = Option.none();

  const response = await workspaceRequest({
    guest,
    machineId,
    generation,
    step: WorkspaceStep.Release,
    part,
    init: { method: HttpMethod.Delete },
    lease,
  });

  return response.status === HttpStatusCode.Ok;
}
