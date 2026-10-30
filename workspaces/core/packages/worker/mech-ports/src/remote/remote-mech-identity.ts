import { RemoteToolsOutcome } from '@mechane/protocol';
import { readWorkspacePolicy } from '@mechane/rpc';
import { Option, Result } from 'effect';
import type { MechRemoteToolsInput, RunGrantedToolInput } from './types.ts';

type RemoteMechIdentity = Pick<RunGrantedToolInput, 'workspaceId' | 'mechId'>;

/** Each discovery or call reads the current workspace suspension before consulting grants. */
export async function remoteMechIdentity({
  store,
  settings,
}: MechRemoteToolsInput): Promise<Result.Result<RemoteMechIdentity, RemoteToolsOutcome>> {
  const mech = await store.atomic({ run: (tables) => tables.mech() });

  if (Option.isNone(mech)) {
    const refusal = RemoteToolsOutcome.cases.Refused.make({ reason: 'Remote tools are unavailable for this mech' });

    return Result.fail(refusal);
  }

  const policy = await readWorkspacePolicy({ bindings: settings, workspaceId: mech.value.workspaceId });

  if (policy.isSuspended) {
    const refusal = RemoteToolsOutcome.cases.Refused.make({ reason: 'Remote tools are unavailable for this mech' });

    return Result.fail(refusal);
  }

  return Result.succeed({ workspaceId: mech.value.workspaceId, mechId: mech.value.id });
}
