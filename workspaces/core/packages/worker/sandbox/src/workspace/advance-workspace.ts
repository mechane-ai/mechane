import { Option } from 'effect';
import { advanceCheckpoint } from '../checkpoints/advance-checkpoint.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { retireWorkspace } from './retire-workspace.ts';

/** Advances bounded retirement or checkpoint work before the next command is dispatched. */
export async function advanceWorkspace({ store, provider, workspace }: WorkspaceProviderStepInput): Promise<boolean> {
  const state = store.workspace();
  const isRecovering = Option.isSome(state.recovery);
  const isRetired = isRecovering || (await retireWorkspace({ store, workspace }));

  if (!isRetired) {
    return false;
  }

  const checkpoint = store.workspace().checkpoint;

  if (Option.isSome(checkpoint)) {
    await advanceCheckpoint({ store, provider, workspace, checkpoint: checkpoint.value });

    return false;
  }

  return true;
}
