import { ExecutionStatus } from '@mechane/sandbox-store';
import type { ExecutionId } from '@mechane/sandbox-wire';
import { Option } from 'effect';
import type { DateTime } from 'effect';
import { observeMachine } from '../machines/observe-machine.ts';
import type { WorkspaceProviderStepInput } from '../types.ts';
import { advanceWorkspace } from '../workspace/advance-workspace.ts';
import { askGuest } from './ask-guest.ts';

type AdvanceSandboxInput = WorkspaceProviderStepInput & {
  readonly executionId: ExecutionId;
  readonly deadline: DateTime.Utc;
};

/** An older execution owns the workspace until its checkpoint commits or its machine is lost. */
export async function advanceSandbox({
  store,
  provider,
  workspace,
  executionId,
  deadline,
}: AdvanceSandboxInput): Promise<boolean> {
  const isReady = await advanceWorkspace({ store, provider, workspace });

  if (!isReady) {
    return false;
  }

  await observeMachine({ store, provider });

  const active = store.activeExecution();

  if (Option.isSome(active) && active.value.id !== executionId && active.value.status === ExecutionStatus.Dispatched) {
    await askGuest({ store, provider, workspace, execution: active.value, deadline });

    return false;
  }

  return true;
}
