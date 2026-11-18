import { FileCheckpointPurpose } from '@mechane/sandbox-store';
import { Option } from 'effect';
import { releaseAutomaticCheckpoint } from '../checkpoints/release-automatic-checkpoint.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { cancelUnstartedIdleStop } from './cancel-idle-stop.ts';

type AdvanceWorkspaceInput = WorkspaceProviderStepInput & { readonly shouldAdmitCommand: boolean };

/** Required barriers retain admission; an immutable automatic archive uploads independently of live commands. */
export async function advanceWorkspace({
  store,
  provider,
  shouldAdmitCommand,
}: AdvanceWorkspaceInput): Promise<boolean> {
  const state = store.workspace();

  if (Option.isSome(state.recovery)) {
    return false;
  }

  const checkpoint = state.checkpoint;

  if (Option.isNone(checkpoint)) {
    if (shouldAdmitCommand) {
      await cancelUnstartedIdleStop({ store, provider });
    }

    return true;
  }

  if (!shouldAdmitCommand || !FileCheckpointPurpose.guards.Automatic(checkpoint.value.purpose)) {
    return false;
  }

  if (Option.isSome(checkpoint.value.archive) && !checkpoint.value.isAborting) {
    return true;
  }

  return await releaseAutomaticCheckpoint({ store, provider, checkpoint: checkpoint.value });
}
