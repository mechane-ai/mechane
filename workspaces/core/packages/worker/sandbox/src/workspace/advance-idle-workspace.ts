import { Option } from 'effect';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from './advance-workspace.ts';

/** Completes pending transfers before idle stop and protects files whose last save failed. */
export async function advanceIdleWorkspace({
  store,
  provider,
  workspace,
}: WorkspaceProviderStepInput): Promise<boolean> {
  const state = store.workspace();

  if (Option.isSome(state.recovery)) {
    return false;
  }

  return await advanceWorkspace({ store, provider, workspace });
}
